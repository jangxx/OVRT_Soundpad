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

	def start(self):
		port = self._config.get(["server", "ws_port"])

		logger.info(f"Websocket server is running on port {port}")
		self._server = asyncio.get_event_loop().run_until_complete(websockets.serve(self.connHandler, "localhost", port))

	async def stop(self):
		self._server.close()
		await self._server.wait_closed()

	def commandHandler(self, command, params):
		pass

	async def connHandler(self, socket, path):
		print("client connected")

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
					self.commandHandler(msg["command"], msg["params"])

				print(msg)
                # if msg == "register":
                #     self._clients.add(socket)
                # elif msg == "discover":
                #     await socket.send("success")

		except websockets.ConnectionClosedError:
			pass
		finally:
			# self._clients.discard(socket)
			print("Client disconnected")