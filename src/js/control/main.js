const Vue = require("vue/dist/vue.common");
const { matchSorter } = require("match-sorter");

const { WebSocketConn } = require("../lib/websocket");
const { OVRT, OVRTOverlay } = require("../lib/ovrt-helper");
const VersionCheckMixin = require("../lib/VersionCheckMixin");

function make_sound_index(page, row, column) {
	return `${page}:${row},${column}`;
}

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
		fill_page_modal_visible: false,
		full_soundlist: {},
		categories: [],
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
		fill_page: {
			selected_category: 0,
			selected_dup_mode: "ignore", // "ignore", "skip",
			selected_page_mode: "skip", // "skip", "next_page", "create_pages", "next_create_pages"
		}
	},
	mixins: [ VersionCheckMixin ],
	computed: {
		full_board() {
			const columns = [];
			for (let c = 0; c < this.columns; c++) {
				const row = [];
				for (let r = 0; r < this.rows; r++) {
					const sound_index = make_sound_index(this.current_page, r, c);

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
		soundlist_sorted() {
			return Object.keys(this.full_soundlist).sort(
				(sid1, sid2) => this.full_soundlist[sid1].title.localeCompare(this.full_soundlist[sid2].title)
			);
		},
		modal_visible() {
			if (this.bridge_update_required) return 1;
			if (this.bridge_too_new) return 4;

			if (!this.connected) return 2;

			if (this.connected && !this.sp_connected) return 3;

			return 0;
		},
		display_categories() {
			return [
				{
					name: "All Sounds",
					sounds: this.soundlist_sorted,
				},
				...this.categories.map(cat => {
					const sound_set = new Set(cat.sounds);
					return {
						name: cat.name,
						sounds: this.soundlist_sorted.filter(sid => sound_set.has(sid)), // pick the sounds in this category from the sorted sound list
					}
				})
			]
		},
		fill_page_result() {
			const result = {
				all_sounds: this.display_categories[this.fill_page.selected_category].sounds,
				add_sounds: this.display_categories[this.fill_page.selected_category].sounds,
				final_add_sounds: null,
				free_spaces: {},
				required_additional_pages: 0,
				all_sounds_fit: true,
			};
			
			if (this.fill_page.selected_dup_mode == "skip") {
				const existing_sounds = new Set(Object.values(this.sounds));
				result.add_sounds = result.all_sounds.filter(sid => !existing_sounds.has(sid));
			}

			// create a map of all possible free spaces on the current board and all that come after it
			for (let p = this.current_page; p < this.pages; p++) {
				result.free_spaces[p] = [];
				for (let r = 0; r < this.rows; r++) {
					for (let c = 0; c < this.columns; c++) {
						const check_si = make_sound_index(p, r, c);
						if (!(check_si in this.sounds)) {
							result.free_spaces[p].push({ r, c });
						}
					}
				}
			}

			if (result.add_sounds.length > result.free_spaces[this.current_page].length) { // we don't have enough space on the current page
				result.all_sounds_fit = false;

				switch (this.fill_page.selected_page_mode) {
					case "skip":
						// remove sounds that don't fit
						result.final_add_sounds = result.add_sounds.slice(0, result.free_spaces[this.current_page].length);
						break;
					case "next_page": {
						// remove sounds that don't fit
						let next_pages_space = 0;
						for (const p in result.free_spaces) {
							next_pages_space += result.free_spaces[p].length;
						}
						result.final_add_sounds = result.add_sounds.slice(0, next_pages_space);
						break;
					}
					case "create_pages": {
						// calculate number of required pages
						let new_pages_sound_count = result.add_sounds.length - result.free_spaces[this.current_page].length;
						result.required_additional_pages = Math.ceil(new_pages_sound_count / (this.rows * this.columns));
						// it's possible that we would need to add more pages than we can fit into the max of 10 -> create fewer and skip the rest
						result.required_additional_pages = Math.min(result.required_additional_pages, 10 - this.pages);
						new_pages_sound_count = Math.min(new_pages_sound_count, result.required_additional_pages * (this.rows * this.columns));

						result.final_add_sounds = result.add_sounds.slice(0, result.free_spaces[this.current_page].length + new_pages_sound_count);
						break;
					}
					case "next_create_pages": {
						let next_pages_space = 0;
						for (const p in result.free_spaces) {
							next_pages_space += result.free_spaces[p].length;
						}

						// calculate number of required pages
						let new_pages_sound_count = result.add_sounds.length - next_pages_space;
						result.required_additional_pages = Math.ceil(new_pages_sound_count / (this.rows * this.columns));
						// it's possible that we would need to add more pages than we can fit into the max of 10 -> create fewer and skip the rest
						result.required_additional_pages = Math.min(result.required_additional_pages, 10 - this.pages);
						new_pages_sound_count = Math.min(new_pages_sound_count, result.required_additional_pages * (this.rows * this.columns));

						result.final_add_sounds = result.add_sounds.slice(0, result.free_spaces[this.current_page].length + next_pages_space + new_pages_sound_count);
						break;
					}
				}

				return result;
			} else { // we do have enough space. perfect!
				result.final_add_sounds = result.add_sounds;
				return result;
			}
		},
	},
	methods: {
		async refreshSoundlist() {
			const resp = await fetch("http://localhost:64152/api/soundlist");
			const data = await resp.json();

			this.full_soundlist = data.soundlist;
		},
		async refreshCategories() {
			const resp = await fetch("http://localhost:64152/api/categories");
			const data = await resp.json();

			this.categories = data.categories;
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
		showFillPageModal() {
			this.refreshCategories().then(() => {
				this.fill_page_modal_visible = true;
			});
		},
		fillPage() {
			if (this.fill_page_result.all_sounds_fit) {
				for (let i = 0; i < this.fill_page_result.final_add_sounds.length; i++) {
					this.ws.sendCommand("select-sound", {
						row: this.fill_page_result.free_spaces[this.current_page][i].r,
						col: this.fill_page_result.free_spaces[this.current_page][i].c,
						page: this.current_page,
						sound: this.fill_page_result.final_add_sounds[i],
						prevent_event: true,
					});
				}
			} else {
				switch (this.fill_page.selected_page_mode) {
					case "skip": { // this is the same thing than happens when the sounds all actually fit
						for (let i = 0; i < this.fill_page_result.final_add_sounds.length; i++) {
							this.ws.sendCommand("select-sound", {
								row: this.fill_page_result.free_spaces[this.current_page][i].r,
								col: this.fill_page_result.free_spaces[this.current_page][i].c,
								page: this.current_page,
								sound: this.fill_page_result.final_add_sounds[i],
								prevent_event: true,
							});
						}
						break;
					}
					case "next_page": {
						const free_spaces_flattened = Object.keys(this.fill_page_result.free_spaces)
							.map(p => this.fill_page_result.free_spaces[p].map(s => { return { p: Number(p), ...s } }))
							.flat();

						for (let i = 0; i < this.fill_page_result.final_add_sounds.length; i++) {
							this.ws.sendCommand("select-sound", {
								row: free_spaces_flattened[i].r,
								col: free_spaces_flattened[i].c,
								page: free_spaces_flattened[i].p,
								sound: this.fill_page_result.final_add_sounds[i],
								prevent_event: true,
							});
						}
						break;
					}
					case "create_pages": {
						const current_pages = this.pages;
						const new_pages_count = current_pages + this.fill_page_result.required_additional_pages;
						this.ws.sendCommand("change-settings", { setting: ["board", "pages" ], value: new_pages_count, prevent_event: true });

						// create a flat list of all spaces. first add the free spaces from the current page
						const spaces = this.fill_page_result.free_spaces[this.current_page].map(s => { return { p: this.current_page, ...s }});
						
						// and then add all new spaces from the new pages
						for (let np = current_pages; np < new_pages_count; np++) {
							for (let r = 0; r < this.rows; r++) {
								for (let c = 0; c < this.columns; c++) {
									spaces.push({ p: np, r, c });
								}
							}
						}

						for (let i = 0; i < this.fill_page_result.final_add_sounds.length; i++) {
							this.ws.sendCommand("select-sound", {
								row: spaces[i].r,
								col: spaces[i].c,
								page: spaces[i].p,
								sound: this.fill_page_result.final_add_sounds[i],
								prevent_event: true,
							});
						}
						break;
					}
					case "next_create_pages": {
						const current_pages = this.pages;
						const new_pages_count = current_pages + this.fill_page_result.required_additional_pages;
						this.ws.sendCommand("change-settings", { setting: ["board", "pages" ], value: new_pages_count, prevent_event: true });

						// create a flat list of all spaces. first add the free spaces from all existing pages
						const spaces = Object.keys(this.fill_page_result.free_spaces)
							.map(p => this.fill_page_result.free_spaces[p].map(s => { return { p: Number(p), ...s } }))
							.flat();
						
						// and then add all new spaces from the new pages
						for (let np = current_pages; np < new_pages_count; np++) {
							for (let r = 0; r < this.rows; r++) {
								for (let c = 0; c < this.columns; c++) {
									spaces.push({ p: np, r, c });
								}
							}
						}

						for (let i = 0; i < this.fill_page_result.final_add_sounds.length; i++) {
							this.ws.sendCommand("select-sound", {
								row: spaces[i].r,
								col: spaces[i].c,
								page: spaces[i].p,
								sound: this.fill_page_result.final_add_sounds[i],
								prevent_event: true,
							});
						}
						break;
					}
				}
			}

			this.ws.sendCommand("emit-settings-change");
			this.fill_page_modal_visible = false;
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