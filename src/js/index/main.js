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
		last_overlay_position: null,
	},
	methods: {
		openOverlay: async function() {
			const overlay_id = await this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard");

			this.overlay_id = overlay_id;

			if (overlay_id == -1) {
				let overlay_pos = this.last_overlay_position;

				let initial_placement = false;
				if (overlay_pos == null) {
					overlay_pos = await this.ovrt_api.getWristwatchTransform();
					overlay_pos = Object.assign({}, overlay_pos, INITIAL_POSITION);
					initial_placement = true;
				}

				const overlay = await this.ovrt_api.spawnOverlay(overlay_pos);
				this.overlay_id = overlay.id;
				
				if (initial_placement) {
					overlay.translateUp(0.25); // move up 25cm
				}

				overlay.setBrowserOptionsEnabled(false);

				overlay.setContent(0, {
					url: "control.html",
					width: this.columns * 250,
					height: this.rows * 200,
				});
			}
		},
		closeOverlay: async function() {
			const overlay_id = await this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard");

			if (overlay_id != -1) {
				this.ovrt_api.closeOverlay(overlay_id);
			}

			this.overlay_id = -1;
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
			this.ws.sendCommand("set-edit-mode", { value: this.edit_mode });
		}
	},
	created: function() {
		this.ws = new WebSocketConn();
		this.ovrt_api = new OVRT({ function_queue: true });

		this.ovrt_api.isAppRunningWithTitle("Soundpad Soundboard").then(overlay_id => {
			this.overlay_id = overlay_id;

			// attach even listener to overlay close
			this.ovrt_api.on("overlay-closed", evt => {
				if (evt.uid == this.overlay_id) {
					this.overlay_id = -1;
				}
			});
		});

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
			this.last_overlay_position = evt.detail.overlay;
		});

		this.ws.addEventListener("state-update", evt => {
			// console.log(evt.detail);
			this.edit_mode = evt.detail.edit_mode;
			this.sp_connected = evt.detail.soundpad_connected;
		});

		this.ws.open("index");
	},
});

window.addEventListener("DOMContentLoaded", () => {
	app.$mount("main");
});