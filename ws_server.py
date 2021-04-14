import asyncio, json

import websockets
from sanic.log import logger

# yes I know that it's very lazy to run a separate WS and HTTP server, when both could be run on the same port
# I don't like sanics WS implementation tho and this is just a quick and dirty project anyway, so there is no reason to get all that fancy

class WebsocketServer:
	def __init__(self, config, sp_manager):
		self._server = None
		self._config = config
		self._soundpad = sp_manager

		# ephemeral state
		self._state = {
			"edit_mode": False,
			"soundpad_connected": False,
		}

		self._index_sockets = set()
		self._control_sockets = set()

	def start(self):
		port = self._config.get(["server", "ws_port"])

		logger.info(f"Websocket server is running on port {port}")
		self._server = asyncio.get_event_loop().run_until_complete(websockets.serve(self.connHandler, "localhost", port))

	async def stop(self):
		self._server.close()
		await self._server.wait_closed()

	async def changeState(self, key, value):
		self._state[key] = value
		await self.emitEvent("state-update", self._state)

	async def commandHandler(self, socket, command, params):
		if command == "register":
			if params["as"] == "index":
				self._index_sockets.add(socket)
			elif params["as"] == "control":
				self._control_sockets.add(socket)

			await self.emitEvent("settings-change", {
				"board": self._config.get("board"),
				"sounds": self._config.get("sounds"),
			}, socket=socket, index_sockets=False, control_sockets=False)

			await self.emitEvent("state-update", self._state, socket=socket, index_sockets=False, control_sockets=False)

		elif command == "change-settings":
			self._config.set(params["setting"], params["value"])
			await self.emitEvent("settings-change", {
				"board": self._config.get("board"),
				"sounds": self._config.get("sounds"),
			})

		elif command == "set-edit-mode":
			self._state["edit_mode"] = params["value"]
			await self.emitEvent("state-update", self._state)

		elif command == "select-sound":
			# calc index of the sound
			board = self._config.get("board")
			sound_index = params["row"] * board["columns"] + params["col"]

			self._config.set([ "sounds", sound_index ], params["sound"])
			await self.emitEvent("settings-change", {
				"board": self._config.get("board"),
				"sounds": self._config.get("sounds"),
			}, index_sockets=False)

		elif command == "play-sound":
			sound_id = params["sound"]
			self._soundpad.playSound(sound_id)


	async def emitEvent(self, event, data, socket=None, index_sockets=True, control_sockets=True):
		msg = json.dumps({ "type": "event", "event": event, "data": data })

		if socket is not None:
			await socket.send(msg)
		if index_sockets:
			for socket in self._index_sockets:
				await socket.send(msg)
		if control_sockets:
			for socket in self._control_sockets:
				await socket.send(msg)

	async def connHandler(self, socket, path):
		print("Client connected")

		try:
			async for raw_msg in socket:
				try:
					msg = json.loads(raw_msg)
				except err:
					logger.error(f"Could not parse JSON: {repr(err)}")
					continue

				if not "type" in msg:
					continue

				if msg["type"] == "command":
					if not "command" in msg or not "params" in msg:
						continue
					await self.commandHandler(socket, msg["command"], msg["params"])

				# print(msg)

				# await socket.send(json.dumps(msg))

                # if msg == "register":
                #     self._clients.add(socket)
                # elif msg == "discover":
                #     await socket.send("success")

		except websockets.ConnectionClosedError:
			pass
		finally:
			if socket in self._index_sockets:
				self._index_sockets.discard(socket)
			if socket in self._control_sockets:
				self._control_sockets.discard(socket)
			print("Client disconnected")