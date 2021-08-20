const Vue = require("vue/dist/vue.common");
const { OVRT, OVRTOverlay } = require("../lib/ovrt-helper");
const { WebSocketConn } = require("../lib/websocket");

Vue.component("round-switch", {
	template: `
<label class="round-switch">
	<input type="checkbox" :checked="value" :disabled="disabled" @input="$emit('input', $event.target.checked)">
	<span class="slider round" :class="{'disabled': disabled }"></span>
</label>`,
	props: [ "value", "disabled" ],
});

const INITIAL_POSITION = {
	attachedDevice: 3,
	curvature: 0,
	ecoMode: true,
	framerate: 60,
	lookHiding: false,
	opacity: 1,
	posX: -0.06,
	posY: -0.12,
	posZ: -0.34,
	rotX: 106.599035,
	rotY: -41.9955531,
	rotZ: -69.0803113,
	shouldSave: true,
	size: 0.4,
};

const app = new Vue({
	data: {
		connected: false,
		edit_mode: false,
		sp_connected: false,
		rows: 3,
		columns: 4,
		overlay_id: -1,
	},
	methods: {
		openOverlay: function() {
			this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard").then(overlay_id => {
				this.overlay_id = overlay_id;

				if (overlay_id == -1) {
					this.ovrt_api.spawnOverlay(INITIAL_POSITION).then(overlay => {
						this.overlay_id = overlay.id;
						console.log(overlay);
	
						overlay.setContent(0, {
							url: "control.html",
							width: 1000,
							height: 600,
						});
					}).catch(err => {
						console.log(err);
					});
				}
			});
		},
		closeOverlay: function() {
			this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard").then(overlay_id => {
				this.ovrt_api.closeOverlay(overlay_id);
				this.overlay_id = -1;
			});
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
			console.log("toggled")
			this.ws.sendCommand("set-edit-mode", { value: this.edit_mode });
		}
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
		});

		this.ws.addEventListener("state-update", evt => {
			console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_connected;
		});

		this.ws.open("index");

		setInterval(() => {
			this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard").then(overlay_id => {
				if (overlay_id == -1) return;

				const o = new OVRTOverlay(overlay_id);
				o.getTransform().then(transform => console.log(transform));
			});
		}, 2000);
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});