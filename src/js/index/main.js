const Vue = require("vue/dist/vue.common");
const nd = require("nd4js");
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

				if (overlay_pos == null) {
					overlay_pos = await this.ovrt_api.getWristwatchTransform();
					overlay_pos = Object.assign({}, overlay_pos, INITIAL_POSITION);
					// overlay_pos.posY += 0.3; // spawn 30cm above the wrist watch

					const Rz = nd.array([
						[ Math.cos(overlay_pos.rotZ), -Math.sin(overlay_pos.rotZ), 0, 0 ],
						[ Math.sin(overlay_pos.rotZ), Math.cos(overlay_pos.rotZ), 0, 0 ],
						[ 0, 0, 1, 0 ],
						[ 0, 0, 0, 1 ],
					]);
					const Rx = nd.array([
						[ 1, 0, 0, 0 ],
						[ 0, Math.cos(overlay_pos.rotX), -Math.sin(overlay_pos.rotX), 0 ],
						[ 0, Math.sin(overlay_pos.rotX), Math.cos(overlay_pos.rotX), 0 ],
						[ 0, 0, 0, 1 ],
					]);
					const Ry = nd.array([
						[ Math.cos(overlay_pos.rotY), 0, Math.sin(overlay_pos.rotY), 0 ],
						[ 0, 1, 0, 0 ],
						[ -Math.sin(overlay_pos.rotY), 0, Math.cos(overlay_pos.rotY), 0 ],
						[ 0, 0, 0, 1 ],
					]);
					const translate = nd.array([
						[ 1, 0, 0, 0 ],
						[ 0, 1, 0, 0.3 ],
						[ 0, 0, 1, 0],
						[ 0, 0, 0, 1],
					]);

					const transform = nd.la.matmul(translate, Ry, Rx, Rz);

					console.log(transform(0, 3), transform(1, 3), transform(2, 3));
				}

				console.log(overlay_pos);

				// return;

				const overlay = await this.ovrt_api.spawnOverlay(overlay_pos);
				this.overlay_id = overlay.id;
				// console.log(overlay);

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