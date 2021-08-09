import signal, asyncio, sys, threading

import pystray
from PIL import Image

from config import Config
from ws_server import WebsocketServer
from http_server import app
from soundpad_manager import SoundpadManager

# soundpad = SoundpadRemote()
# soundpad.init()

# print(soundpad.getSoundList())

# soundpad.deinit()

global_config = Config()

http_server = app.create_server(host="localhost", port=global_config.get(["server", "http_port"]), return_asyncio_server=True)

main_loop = asyncio.get_event_loop()
async_stop_signal = main_loop.create_future()

sp_manager = SoundpadManager()
ws_server = WebsocketServer(global_config, sp_manager)
trayicon = None

app.ctx.sp_manager = sp_manager
sp_manager.start()

def exit():
	async_stop_signal.set_result(True)
	sp_manager.stop()
	trayicon.stop()

traymenu = pystray.Menu(
	pystray.MenuItem("Exit", action=exit)
)

trayimage = Image.open("./ovrt_sp_icon.png")

trayicon = pystray.Icon("ovrt_sp", title="OVR Toolkit Soundpad Bridge", menu=traymenu)
trayicon.icon = trayimage

# all asyncio related stuff happens here
async def async_main():
	await http_server # wait for the http server to start

	initialized_state = False

	while not async_stop_signal.done():
		if initialized_state != sp_manager.is_initialized():
			initialized_state = sp_manager.is_initialized()
			await ws_server.changeState("soundpad_connected", initialized_state)

		await asyncio.sleep(0.1)

	# await asyncio.wait_for(async_stop_signal, None)

	await ws_server.stop()

# main tread after pystray has spawned the tray icon
def main(icon):
	global ws_server

	icon.visible = True

	asyncio.set_event_loop(main_loop)

	ws_server.start()

	main_loop.run_until_complete(async_main())

if __name__ == '__main__':
	signal.signal(signal.SIGINT, signal.SIG_DFL)
	trayicon.run(setup=main)