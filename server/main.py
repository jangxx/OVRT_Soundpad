from queue import Queue
import signal
import asyncio
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
from tkinter.filedialog import askopenfilename
import argparse
import os
import pathlib
import webbrowser

import pystray
from PIL import Image
from appdirs import user_config_dir

parser = argparse.ArgumentParser(description="Bridges the gap between OVR Toolkit and Soundpad")
parser.add_argument("--stdout", action="store_true", help="Log to stdout and stderr instead of redirecting all output to the log file", dest="use_stdout")

args = parser.parse_args()

# create config dir if it doesn't exist
pathlib.Path(user_config_dir("OVRT Soundpad", "jangxx")).mkdir(parents=True, exist_ok=True)

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
from osc_server import OSCServer

global_config = Config()

main_loop = asyncio.new_event_loop()
async_stop_signal = main_loop.create_future()
async_messages = Queue()

sp_manager = SoundpadManager()
ws_server = WebsocketServer(global_config, sp_manager)
osc_server = OSCServer(global_config, sp_manager)
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

def show_info(message, title="Info"):
	root = tk.Tk()
	root.withdraw()
	messagebox.showinfo(title, message)
	root.destroy()

def async_show_info(message, title="Info"):
	async_messages.put_nowait({ "type": "info", "message": message, "title": title })

def clear_soundpad_path():
	global_config.set(["soundpad", "autostart_path"], None)

def toggle_steam_autolaunch():
	global_config.set(["soundpad", "launch_soundpad_steam"], not global_config.get(["soundpad", "launch_soundpad_steam"]))

def toggle_osc_integration():
	global_config.set(["osc", "enable"], not global_config.get(["osc", "enable"]))

	if global_config.get(["osc", "enable"]):
		async_show_info("The OSC integration has been enabled. Please restart the program for this change to have an effect")
	else:
		async_show_info("The OSC integration has been disabled. Please restart the program for this change to have an effect")

def generate_menu():
	if global_config.get(["soundpad", "autostart_path"]) is None and not global_config.get(["soundpad", "launch_soundpad_steam"]):
		yield pystray.MenuItem("Autostart Soundpad from Steam", action=toggle_steam_autolaunch, checked=lambda i: global_config.get(["soundpad", "launch_soundpad_steam"]))
		yield pystray.MenuItem("Set Soundpad path", action=set_soundpad_path)
	if global_config.get(["soundpad", "autostart_path"]) is not None:
		yield pystray.MenuItem("Clear Soundpad path", action=clear_soundpad_path)
	if global_config.get(["soundpad", "launch_soundpad_steam"]):
		yield pystray.MenuItem("Autostart Soundpad from Steam", action=toggle_steam_autolaunch, checked=lambda i: global_config.get(["soundpad", "launch_soundpad_steam"]))
	if global_config.get(["osc", "enable"]):
		yield pystray.MenuItem("Disable OSC integration", action=toggle_osc_integration)
	else:
		yield pystray.MenuItem("Enable OSC integration", action=toggle_osc_integration)

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
		# wait for the http server to start
		http_server = await app.create_server(
			host="localhost", 
			port=global_config.get(["server", "http_port"]), 
			return_asyncio_server=True
		)
		await http_server.startup()
	except OSError as e:
		if e.errno == 10048:
			show_error(f"Cannot bind to port {global_config.get(['server', 'http_port'])}. Is another instance of the bridge already running?")
		else:
			show_error(f"Could not start the http server: {e.strerror}")
		return exit_program()
	except Exception as e:
		show_error(f"Could not start the http server: {repr(e)}")
		return exit_program()

	if global_config.get([ "osc", "enable" ]):
		try:
			await osc_server.start(main_loop)
		except Exception as e:
			show_error(f"Could not start the OSC server: {repr(e)}")
			return exit_program()

	initialized_state = False

	# main loop
	while not async_stop_signal.done():
		if initialized_state != sp_manager.is_initialized():
			initialized_state = sp_manager.is_initialized()
			await ws_server.changeState("soundpad_connected", initialized_state)

		if not async_messages.empty():
			msg = async_messages.get_nowait()
			if msg["type"] == "info":
				show_info(msg["message"], msg["title"])

		await asyncio.sleep(0.1)

	# await asyncio.wait_for(async_stop_signal, None)

	await ws_server.stop()
	osc_server.stop()

# main tread after pystray has spawned the tray icon
def main(icon):
	global ws_server

	icon.visible = True

	asyncio.set_event_loop(main_loop)
	ws_server.setLoop(main_loop)

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

	if global_config.get(["soundpad", "launch_soundpad_steam"]) and not sp_manager.is_initialized():
		webbrowser.open_new("steam://run/629520")

	trayicon.run(setup=main)
