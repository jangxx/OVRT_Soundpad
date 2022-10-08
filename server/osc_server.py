from math import floor
from config import Config
from soundpad_manager import SoundpadManager

from pythonosc import osc_server, dispatcher
from sanic.log import logger

class OSCServer:
	def __init__(self, config: Config, sp_manager: SoundpadManager):
		self._config = config
		self._soundpad = sp_manager
		self._transport = None

	async def start(self, loop):
		osc_dispatcher = dispatcher.Dispatcher()
		
		osc_dispatcher.map(self._config.get([ "osc", "play_board_address" ]), self.handle_osc_play_board)
		osc_dispatcher.map(self._config.get([ "osc", "play_index_address" ]), self.handle_osc_play_index)

		osc_input_server = osc_server.AsyncIOOSCUDPServer(
			(self._config.get([ "osc", "listen_address" ]), self._config.get([ "osc", "listen_port" ])),
			osc_dispatcher,
			loop
		)

		logger.info(f"OSC server is listening on {self._config.get([ 'osc', 'listen_address' ])}:{self._config.get([ 'osc', 'listen_port' ])}")

		self._transport, _ = await osc_input_server.create_serve_endpoint()

	def stop(self):
		if self._transport:
			self._transport.close()

	def handle_osc_play_board(self, address, *args):
		if type(args[0]) is not int:
			return

		board_pos = args[0]

		page = floor((board_pos % 1000) / 100)
		row = floor((board_pos % 100) / 10)
		col = (board_pos % 10)

		sound_index = f"{page}:{row},{col}"
		if self._config.exists([ "sounds", sound_index ]):
			sound_id = self._config.get([ "sounds", sound_index ])
			self._soundpad.playSound(sound_id)

	def handle_osc_play_index(self, address, *args):
		if type(args[0]) is not int:
			return

		index = args[0]

		self._soundpad.playSoundByIndex(index)
