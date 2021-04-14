const app = new Vue({
	data: {
		connected: false,
		edit_mode: false,
		sp_connected: false,
		rows: 3,
		columns: 4,
	},
	methods: {
		openOverlay: function() {

		},
		modRows: function(dir) {
			this.rows += dir;

			if (this.rows < 1) this.rows = 1;
			if (this.rows > 10) this.rows = 10;

			this.ws.sendCommand("change-settings", { setting: ["board", "rows" ], value: this.rows })
		},
		modColumns: function(dir) {
			this.columns += dir;

			if (this.columns < 1) this.columns = 1;
			if (this.columns > 10) this.columns = 10;

			this.ws.sendCommand("change-settings", { setting: ["board", "columns" ], value: this.columns })
		},
		toggleEditMode: function() {
			this.edit_mode = !this.edit_mode;
			this.ws.sendCommand("set-edit-mode", { value: this.edit_mode });
		}
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
		});

		this.ws.addEventListener("state-update", evt => {
			console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_co
		});

		this.ws.open("index");
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});