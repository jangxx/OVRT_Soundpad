import signal
import asyncio
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
from tkinter.filedialog import askopenfilename
import argparse
import os

import pystray
from PIL import Image
from appdirs import user_config_dir

parser = argparse.ArgumentParser(description="Bridges the gap between OVR Toolkit and Soundpad")
parser.add_argument("--stdout", action="store_true", help="Log to stdout and stderr instead of redirecting all output to the log file", dest="use_stdout")

args = parser.parse_args()

if not args.use_stdout:
	log_file_path = os.path.join(user_config_dir("OVRT Soundpad", "jangxx"), "output.log")
	log_file = open(log_file_path, "a", buffering=1)
	sys.stdout = log_file
	sys.stderr = log_file

# this has to happen after we setup the stdout and stderr redirection
from config import Config
from ws_server import WebsocketServer
from http_server import app
from soundpad_manager import SoundpadManager

global_config = Config()

http_server = app.create_server(host="localhost", port=global_config.get(["server", "http_port"]), return_asyncio_server=True)

main_loop = asyncio.get_event_loop()
async_stop_signal = main_loop.create_future()

sp_manager = SoundpadManager()
ws_server = WebsocketServer(global_config, sp_manager)
trayicon = None

app.ctx.sp_manager = sp_manager
sp_manager.start()

def exit_program():
	async_stop_signal.set_result(True)
	sp_manager.stop()
	trayicon.stop()

def set_soundpad_path():
	root = tk.Tk()
	root.withdraw()
	filename = askopenfilename(filetypes=[("Soundpad.exe", "*.exe")])
	root.destroy()

	if len(filename) == 0:
		return

	global_config.set(["soundpad", "autostart_path"], filename)

def show_error(message, title="Error"):
	root = tk.Tk()
	root.withdraw()
	messagebox.showerror(title, message)
	root.destroy()

def clear_soundpad_path():
	global_config.set(["soundpad", "autostart_path"], None)

def generate_menu():
	yield pystray.MenuItem("Set Soundpad path", action=set_soundpad_path)
	if global_config.get(["soundpad", "autostart_path"]) is not None:
		yield pystray.MenuItem("Clear Soundpad path", action=clear_soundpad_path)
	yield pystray.MenuItem("Exit", action=exit_program)

traymenu = pystray.Menu(generate_menu)

if not getattr(sys, "frozen", False):
	trayimage = Image.open("./assets/img/ovrt_sp_icon.png")
else:
	trayimage = Image.open("ovrt_sp_icon.png")

trayicon = pystray.Icon("ovrt_sp", title="OVR Toolkit Soundpad Bridge", menu=traymenu)
trayicon.icon = trayimage

# all asyncio related stuff happens here
async def async_main():
	try:
		await http_server # wait for the http server to start
	except OSError as e:
		if e.errno == 10048:
			show_error(f"Cannot bind to port {global_config.get(['server', 'http_port'])}. Is another instance of the bridge already running?")
		else:
			show_error(f"Could not start the websocket server: {e.strerror}")
		return exit_program()
	except Exception as e:
		show_error(f"Could not start the websocket server: {repr(e)}")
		return exit_program()

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

	try:
		ws_server.start()
	except OSError as e:
		if e.errno == 10048:
			show_error(f"Cannot bind to port {global_config.get(['server', 'ws_port'])}. Is another instance of the bridge already running?")
		else:
			show_error(f"Could not start the websocket server: {e.strerror}")
		return exit_program()
	except Exception as e:
		show_error(f"Could not start the websocket server: {repr(e)}")
		return exit_program()

	main_loop.run_until_complete(async_main())

if __name__ == '__main__':
	signal.signal(signal.SIGINT, signal.SIG_DFL)

	# if soundpad is not running try launching it
	if global_config.get(["soundpad", "autostart_path"]) is not None and not sp_manager.is_initialized():
		subprocess.Popen([ global_config.get(["soundpad", "autostart_path"]) ], start_new_session=True)

	trayicon.run(setup=main)
