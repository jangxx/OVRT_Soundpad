import asyncio, json

from config import Config
from soundpad_manager import SoundpadManager
from version import BRIDGE_VERSION

import websockets
from sanic.log import logger

# yes I know that it's very lazy to run a separate WS and HTTP server, when both could be run on the same port
# I don't like sanics WS implementation tho and this is just a quick and dirty project anyway, so there is no reason to get all that fancy

class WebsocketServer:
	def __init__(self, config: Config, sp_manager: SoundpadManager):
		self._server = None
		self._loop = None
		self._config = config
		self._soundpad = sp_manager

		# ephemeral state
		self._state = {
			"edit_mode": False,
			"soundpad_connected": False,
			"version": BRIDGE_VERSION,
		}

		self._index_sockets = set()
		self._control_sockets = set()

	def setLoop(self, loop):
		self._loop = loop

	def start(self):
		if not self._loop:
			raise Exception("asyncio loop has not been set")

		port = self._config.get(["server", "ws_port"])

		logger.info(f"Websocket server is running on port {port}")
		self._server = self._loop.run_until_complete(websockets.serve(self.connHandler, "localhost", port))

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

			await self.emitEvent("settings-change", self._config.getExternalSerialized(), socket=socket, index_sockets=False, control_sockets=False)

			await self.emitEvent("state-update", self._state, socket=socket, index_sockets=False, control_sockets=False)

		elif command == "change-settings":
			if params["setting"] == [ "board", "rows" ] or params["setting"] == [ "board", "columns" ]:
				if not 1 <= params["value"] <= 10:
					return # invalid values are not allowed

			self._config.set(params["setting"], params["value"])

			if not "prevent_event" in params or not params["prevent_event"]:
				await self.emitEvent("settings-change", self._config.getExternalSerialized())

		elif command == "set-edit-mode":
			self._state["edit_mode"] = params["value"]
			await self.emitEvent("state-update", self._state)

		elif command == "select-sound":
			if not 0 <= params['page'] <= 9 or not 0 <= params['row'] <= 9 or not 0 <= params['col'] <= 9:
				return # out of bounds

			if params['page'] == 0 and self._config.exists([ "sounds", f"{params['row']},{params['col']}" ]):
				self._config.delete([ "sounds", f"{params['row']},{params['col']}" ])

			sound_index = f"{params['page']}:{params['row']},{params['col']}"

			if params["sound"] is not None:
				self._config.set([ "sounds", sound_index ], params["sound"])
			else:
				self._config.delete_safe([ "sounds", sound_index ])

			if not params["prevent_event"]:
				await self.emitEvent("settings-change", self._config.getExternalSerialized(), index_sockets=False)

		elif command == "clear-page":
			if not 0 <= params['page'] <= 9:
				return # out of bounds

			for row in range(10):
				for col in range(10):
					sound_index = f"{params['page']}:{row},{col}"
					self._config.delete_safe([ "sounds", sound_index ])

					# also delete the legacy entries
					if params['page'] == 0:
						sound_index = f"{row},{col}"
						self._config.delete_safe([ "sounds", sound_index ])

			await self.emitEvent("settings-change", self._config.getExternalSerialized(), index_sockets=False)

		elif command == "play-sound":
			sound_id = params["sound"]
			self._soundpad.playSound(sound_id)

		elif command == "stop-sound":
			self._soundpad.stopSound()

		elif command == "pause-sound":
			self._soundpad.pauseSound()

		elif command == "emit-settings-change":
			await self.emitEvent("settings-change", self._config.getExternalSerialized())

		elif command == "log":
			if "message" in params:
				logger.info("Log: " + params["message"])
			else:
				logger.info("Log: " + json.dumps(params))

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
				except Exception as err:
					logger.error(f"Could not parse JSON: {repr(err)}")
					continue

				if not "type" in msg:
					continue

				if msg["type"] == "command":
					if not "command" in msg or not "params" in msg:
						continue
					try:
						await self.commandHandler(socket, msg["command"], msg["params"])
					except Exception as e: # if we get garbage data just ignore
						print(f"Error in commandHandler: {msg['command']}({msg['params']}): {repr(e)}")
						pass

		except websockets.ConnectionClosedError:
			pass
		finally:
			if socket in self._index_sockets:
				self._index_sockets.discard(socket)
			if socket in self._control_sockets:
				self._control_sockets.discard(socket)
			print("Client disconnected")