const Vue = require("vue/dist/vue.common");
const { matchSorter } = require("match-sorter");

const { WebSocketConn } = require("../lib/websocket");
const { OVRT, OVRTOverlay } = require("../lib/ovrt-helper");
const VersionCheckMixin = require("../lib/VersionCheckMixin");

const app = new Vue({
	data: {
		connected: false,
		sp_connected: false,
		edit_mode: false,
		current_page: 0,
		rows: 3,
		columns: 4,
		pages: 1,
		display_soundlist: false,
		confirm_clear_page_visible: false,
		full_soundlist: {},
		sounds: {},
		selected_tile: { row: null, col: null },
		sound_search_input: "",
		soundlist_scroll: {
			scrollTop: 0,
			scrollHeight: 0,
			offsetHeight: 0,
			animation: {
				running: false,
				start: 0,
				duration: 0,
				startScroll: 0,
				scrollDist: 0,
			}
		},
	},
	mixins: [ VersionCheckMixin ],
	computed: {
		full_board() {
			const columns = [];
			for (let c = 0; c < this.columns; c++) {
				const row = [];
				for (let r = 0; r < this.rows; r++) {
					const sound_index = `${this.current_page}:${r},${c}`;

					if (sound_index in this.sounds && this.sounds[sound_index] in this.full_soundlist) {
						row.push(this.full_soundlist[this.sounds[sound_index]]);
					} else {
						row.push(null);
					}
				}
				columns.push(row);
			}

			return columns;
		},
		soundlist_order() {
			const soundlist = matchSorter(Object.keys(this.full_soundlist), this.sound_search_input, { keys: [item => this.full_soundlist[item].title] });

			if (this.$refs.soundlist !== undefined) {
				Vue.nextTick(() => {
					this.update_soundlist_scroll();
				});
			}
			
			return soundlist;
		},
		modal_visible() {
			if (this.bridge_update_required) return 1;
			if (this.bridge_too_new) return 4;

			if (!this.connected) return 2;

			if (this.connected && !this.sp_connected) return 3;

			return 0;
		}
	},
	methods: {
		async refreshSoundlist() {
			const resp = await fetch("http://localhost:64152/api/soundlist");
			const data = await resp.json();

			this.full_soundlist = data.soundlist;
		},
		sendClick(col, row) {
			if (this.edit_mode) {
				this.refreshSoundlist().then(() => {
					this.display_soundlist = true;
					this.selected_tile.row = row;
					this.selected_tile.col = col;
					this.sound_search_input = "";

					Vue.nextTick(() => {
						this.update_soundlist_scroll();
						if (this.$refs.sound_search_input != undefined) {
							this.$refs.sound_search_input.focus();
						}
					});
				});
			} else {
				const sound_index = `${this.current_page}:${row},${col}`;

				if (sound_index in this.sounds) {
					this.ws.sendCommand("play-sound", { sound: this.sounds[sound_index] })
				}
			}
		},
		selectSound(sound_id) {
			this.ws.sendCommand("select-sound", {
				row: this.selected_tile.row,
				col: this.selected_tile.col,
				page: this.current_page,
				sound: sound_id,
				prevent_event: false,
			});
			this.display_soundlist = false;
		},
		stopSound() {
			this.ws.sendCommand("stop-sound");
		},
		pauseSound() {
			this.ws.sendCommand("pause-sound");
		},
		confirmClearPage() {
			this.confirm_clear_page_visible = true;
		},
		clearPage() {
			this.ws.sendCommand("clear-page", { page: this.current_page });
			this.confirm_clear_page_visible = false;
		},
		fillPage() {

		},
		resize() {
			if (this.$refs.soundlist !== undefined) {
				this.update_soundlist_scroll();
			}
		},
		update_soundlist_scroll() {
			this.soundlist_scroll.scrollTop = this.$refs.soundlist.scrollTop;
			this.soundlist_scroll.scrollHeight = this.$refs.soundlist.scrollHeight;
			this.soundlist_scroll.offsetHeight = this.$refs.soundlist.offsetHeight;
		},
		soundlist_scroll_up() {
			if (!("soundlist" in this.$refs)) return;
			this.soundlist_scroll_animation_start(-150, 200)
		},
		soundlist_scroll_down() {
			if (!("soundlist" in this.$refs)) return;
			this.soundlist_scroll_animation_start(150, 200);
		},
		soundlist_scroll_animation_start(dist, time) {
			if (!("soundlist" in this.$refs)) return;

			this.soundlist_scroll.animation.start = performance.now();
			this.soundlist_scroll.animation.duration = time;
			this.soundlist_scroll.animation.startScroll = this.$refs.soundlist.scrollTop;
			this.soundlist_scroll.animation.scrollDist = dist;

			this.soundlist_scroll_animation();
		},
		soundlist_scroll_animation() {
			function f(x) {
				if (x <= 0.5) {
					return 2 * Math.pow(x, 2);
				} else {
					return -2 * Math.pow(x-1, 2) + 1;
				}
			}

			const now = performance.now();
			let t = (now - this.soundlist_scroll.animation.start) / this.soundlist_scroll.animation.duration;

			if (t > 1) t = 1;

			this.$refs.soundlist.scrollTop = this.soundlist_scroll.animation.startScroll + f(t) * this.soundlist_scroll.animation.scrollDist;

			if (t < 1) requestAnimationFrame(this.soundlist_scroll_animation);
		},
	},
	created() {
		this.ws = new WebSocketConn();
		this.ovrt_api = new OVRT({ function_queue: true });
		this.ovrt_overlay = null;

		this.ws.addEventListener("open", () => {
			this.connected = true;
		});

		this.ws.addEventListener("reconnect", () => {
			this.connected = true;
		});

		this.ws.addEventListener("close", () => {
			this.connected = false;
		});

		this.ws.addEventListener("settings-change", evt => {
			if ((this.rows != evt.detail.board.rows || this.columns != evt.detail.board.columns) && this.ovrt_overlay !== null) {
				this.ovrt_overlay.setBrowserResolution(Math.max(evt.detail.board.columns * 250, 800), evt.detail.board.rows * 200 + 50);
			}

			this.rows = evt.detail.board.rows;
			this.columns = evt.detail.board.columns;
			this.pages = evt.detail.board.pages;

			if (this.pages <= this.current_page) {
				this.current_page = 0;
			}

			// console.log("sounds", JSON.stringify(evt.detail.sounds));
			this.sounds = evt.detail.sounds;

			for (let sound_pos in this.sounds) {
				if (sound_pos.search(":") == -1) {
					this.sounds["0:" + sound_pos] = this.sounds[sound_pos];
					delete this.sounds[sound_pos];
				}
			}

			this.refreshSoundlist();
		});

		this.ws.addEventListener("state-update", evt => {
			// console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_connected;

			if(!this.checkVersion(evt.detail.version)) {
				this.ws.close(false);
			};

			if (!this.edit_mode) {
				this.display_soundlist = false;
			}
		});

		this.ws.open("control");

		this.ovrt_api.setCurrentBrowserTitle("Soundpad Soundboard");

		this.ovrt_api.getUniqueID().then(uid => {
			this.ovrt_overlay = new OVRTOverlay(uid);
		});

		this.current_transform = "";

		setInterval(() => {
			if (this.ovrt_overlay === null) return;

			this.ovrt_overlay.getTransform().then(transform => {
				const transform_json = JSON.stringify(transform);

				// only update settings if the transform actually changed
				if (transform_json != this.current_transform) {
					this.current_transform = transform_json;
					this.ws.sendCommand("change-settings", { setting: ["overlay" ], value: transform })
				}
			});
		}, 2000);
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});

window.addEventListener("resize", () => {
	app.resize();
});