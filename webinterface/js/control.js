const app = new Vue({
	data: {
		connected: false,
		rows: 3,
		columns: 4,
		contents: {},
	},
	methods: {
		sendClick: function(col, row) {
			this.ws.sendCommand("box-clicked", { col, row })
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

		this.ws.open();
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});