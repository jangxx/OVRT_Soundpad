const app = new Vue({
	data: {
		connected: false,
		rows: 3,
		columns: 4,
	},
	methods: {
		openOverlay: function() {

		},
		modRows: function(dir) {
			this.rows += dir;
			this.ws.sendCommand("change-settings", { setting: ["board", "rows" ], value: this.rows })
		},
		modColumns: function(dir) {
			this.columns += dir;
			this.ws.sendCommand("change-settings", { setting: ["board", "columns" ], value: this.columns })
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

		this.ws.open("index");
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});