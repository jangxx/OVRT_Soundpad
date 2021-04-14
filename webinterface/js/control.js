const app = new Vue({
	data: {
		connected: false,
		edit_mode: false,
		rows: 3,
		columns: 4,
		contents: {},
		display_soundlist: false,
		full_soundlist: {},
		soundlist_order: [],
		sounds: {},
		selected_tile: { row: null, col: null },
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
			return fetch("/api/soundlist").then(resp => resp.json()).then(data => {
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
	},
	created: function() {
		this.ws = new WebSocketConn();

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
		});

		this.ws.open("control");
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});