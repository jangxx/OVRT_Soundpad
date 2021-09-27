const BRIDGE_VERSION = require("../../../bridge_version.json");
const Vue = require("vue/dist/vue.common");
const { WebSocketConn } = require("../lib/websocket");
const { OVRT, OVRTOverlay } = require("../lib/ovrt-helper");

const app = new Vue({
	data: {
		connected: false,
		sp_connected: false,
		edit_mode: false,
		bridge_update_required: false,
		bridge_update_available: false,
		version_checked: false,
		rows: 3,
		columns: 4,
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
		},
		modal_visible: function() {
			if (this.bridge_update_required) return 1;

			if (!this.connected) return 2;

			if (this.connected && !this.sp_connected) return 3;
		}
	},
	methods: {
		refreshSoundlist: function() {
			return fetch("http://localhost:64152/api/soundlist").then(resp => resp.json()).then(data => {
				this.full_soundlist = data.soundlist;
				this.soundlist_order = Object.keys(data.soundlist);
		
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
		checkVersion: function(version_obj) {
			if (this.version_checked) return; // don't run this on every single state update
			this.bridge_update_required = false;
			this.bridge_update_available = false;

			let version = version_obj;
			if (version_obj === undefined) { // the very first version didn't send version data yet
				version = { major: 1, minor: 0, patch: 0 };
			}

			if (version.major < BRIDGE_VERSION.major || (version.major == BRIDGE_VERSION.major && version.minor < BRIDGE_VERSION.minor)) {
				this.bridge_update_required = true;
				this.ws.close(false);
				return;
			}
			if (version.major == BRIDGE_VERSION.major && version.minor == BRIDGE_VERSION.minor ** version.patch < BRIDGE_VERSION.patch) {
				this.bridge_update_available = true;
			}
		}
	},
	created: function() {
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
				this.ovrt_overlay.setContent(0, {
					url: "control.html",
					width: evt.detail.board.columns * 250,
					height: evt.detail.board.rows * 200,
				});
			}

			this.rows = evt.detail.board.rows;
			this.columns = evt.detail.board.columns;

			// console.log("sounds", JSON.stringify(evt.detail.sounds));
			this.sounds = evt.detail.sounds;
			this.refreshSoundlist();
		});

		this.ws.addEventListener("state-update", evt => {
			// console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_connected;

			this.checkVersion(evt.detail.version);
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