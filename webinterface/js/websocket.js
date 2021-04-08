class WebSocketConn extends EventTarget {
	constructor() {
		super();

		this._socket = null;
		this._reconnectTimeout = null;

		this._msgQueue = [];
	}

	open(isReconnect = false) {
		this._reconnectTimeout = null;
		this._socket = new WebSocket("ws://localhost:64153");

		this._socket.addEventListener("open", () => {
			this.dispatchEvent(new Event(isReconnect ? "reconnect" : "open"));

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
					this.open(true);
				}, 1000); // reconnect after 1 sec
			}			
		});

		this._socket.addEventListener("error", () => {
			this._socket = null;
			this.dispatchEvent(new Event("close"));

			if (this._reconnectTimeout == null) {
				this._reconnectTimeout = setTimeout(() => {
					this.open(true);
				}, 1000); // reconnect after 1 sec
			}			
		});

		this._socket.addEventListener("message", msg => {
			console.log(msg);
		});
	}

	sendCommand(command, params) {
		const msg = JSON.stringify({ type: "command", command, params });

		if (this._socket != null) {
			this._socket.send(msg);
		} else {
			this._msgQueue.push(msg);
		}
	}
}