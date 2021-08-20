const Vue = require("vue/dist/vue.common");
const { WebSocketConn } = require("../lib/websocket");
const { OVRT, OVRTOverlay } = require("../lib/ovrt-helper");

const app = new Vue({
	data: {
		connected: false,
		sp_connected: false,
		edit_mode: false,
		rows: 3,
		columns: 4,
		contents: {},
		display_soundlist: false,
		full_soundlist: {},
		soundlist_order: [],
		sounds: {},
		selected_tile: { row: null, col: null },
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
	computed: {
		full_board: function() {
			const columns = [];
			for (let c = 0; c < this.columns; c++) {
				const row = [];
				for (let r = 0; r < this.rows; r++) {
					const sound_index = `${r},${c}`;

					if (sound_index in this.sounds && this.sounds[sound_index] in this.full_soundlist) {
						row.push(this.full_soundlist[this.sounds[sound_index]]);
					} else {
						row.push(null);
					}
				}
				columns.push(row);
			}

			return columns;
		}
	},
	methods: {
		refreshSoundlist: function() {
			return fetch("http://localhost:64152/api/soundlist").then(resp => resp.json()).then(data => {
				this.full_soundlist = data.soundlist;
				this.soundlist_order = Object.keys(data.soundlist).slice(0, 2);
		
				this.soundlist_order.sort((a, b) => Number(data.soundlist[a].index) - Number(data.soundlist[b].index));
			});
		},
		sendClick: function(col, row) {
			if (this.edit_mode) {
				this.refreshSoundlist().then(() => {
					this.display_soundlist = true;
					this.selected_tile.row = row;
					this.selected_tile.col = col;

					Vue.nextTick(() => {
						this.update_soundlist_scroll();
					});
				});
			} else {
				const sound_index = `${row},${col}`;

				if (sound_index in this.sounds) {
					this.ws.sendCommand("play-sound", { sound: this.sounds[sound_index] })
				}
			}
		},
		selectSound: function(sound_id) {
			this.ws.sendCommand("select-sound", { row: this.selected_tile.row, col: this.selected_tile.col, sound: sound_id });
			this.display_soundlist = false;
		},
		resize: function() {
			if (this.$refs.soundlist !== undefined) {
				this.update_soundlist_scroll();
			}
		},
		update_soundlist_scroll: function() {
			this.soundlist_scroll.scrollTop = this.$refs.soundlist.scrollTop;
			this.soundlist_scroll.scrollHeight = this.$refs.soundlist.scrollHeight;
			this.soundlist_scroll.offsetHeight = this.$refs.soundlist.offsetHeight;
		},
		soundlist_scroll_up: function() {
			if (!("soundlist" in this.$refs)) return;
			this.soundlist_scroll_animation_start(-150, 200)
		},
		soundlist_scroll_down: function() {
			if (!("soundlist" in this.$refs)) return;
			this.soundlist_scroll_animation_start(150, 200);
		},
		soundlist_scroll_animation_start: function(dist, time) {
			if (!("soundlist" in this.$refs)) return;

			this.soundlist_scroll.animation.start = performance.now();
			this.soundlist_scroll.animation.duration = time;
			this.soundlist_scroll.animation.startScroll = this.$refs.soundlist.scrollTop;
			this.soundlist_scroll.animation.scrollDist = dist;

			this.soundlist_scroll_animation();
		},
		soundlist_scroll_animation: function() {
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
	created: function() {
		this.ws = new WebSocketConn();
		this.ovrt_api = new OVRT({ function_queue: true });

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
			this.rows = evt.detail.board.rows;
			this.columns = evt.detail.board.columns;

			console.log("sounds", JSON.stringify(evt.detail.sounds));
			this.sounds = evt.detail.sounds;
			this.refreshSoundlist();
		});

		this.ws.addEventListener("state-update", evt => {
			// console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_connected;
		});

		this.ws.open("control");

		this.ovrt_api.setCurrentBrowserTitle("Soundpad Soundboard");
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});

window.addEventListener("resize", () => {
	app.resize();
});