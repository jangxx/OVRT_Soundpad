class WebSocketConn extends EventTarget {
	constructor() {
		super();

		this._socket = null;
		this._reconnectTimeout = null;

		this._msgQueue = [];
	}

	open(registerType, isReconnect = false) {
		this._reconnectTimeout = null;
		this._socket = new WebSocket("ws://localhost:64153");

		this._socket.addEventListener("open", () => {
			this.dispatchEvent(new Event(isReconnect ? "reconnect" : "open"));

			this._socket.send(JSON.stringify({ type: "command", command: "register", params: { as: registerType } }));

			for (let msg of this._msgQueue) {
				this._socket.send(msg)
			}

			this._msgQueue = [];
		});

		this._socket.addEventListener("close", () => {
			this._socket = null;
			this.dispatchEvent(new Event("close"));

			if (this._reconnectTimeout == null) {
				this._reconnectTimeout = setTimeout(() => {
					this.open(registerType, true);
				}, 1000); // reconnect after 1 sec
			}			
		});

		this._socket.addEventListener("error", err => {
			console.log(err);

			this._socket = null;
			this.dispatchEvent(new Event("close"));

			if (this._reconnectTimeout == null) {
				this._reconnectTimeout = setTimeout(() => {
					this.open(registerType, true);
				}, 1000); // reconnect after 1 sec
			}			
		});

		this._socket.addEventListener("message", evt => {
			const msg = JSON.parse(evt.data);
			// console.log("received", evt.data);

			if (msg.type == "event") {
				this.dispatchEvent(new CustomEvent(msg.event, { detail: msg.data }));
			}
		});
	}

	sendCommand(command, params) {
		const msg = JSON.stringify({ type: "command", command, params });
		// console.log("sent", msg);

		if (this._socket != null) {
			this._socket.send(msg);
		} else {
			this._msgQueue.push(msg);
		}
	}
}