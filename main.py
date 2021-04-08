import signal

import pystray
from PIL import Image

from soundpad_remote import SoundpadRemote
from server import app

# soundpad = SoundpadRemote()
# soundpad.init()

# print(soundpad.getSoundList())

# soundpad.deinit()

# app.run(host="localhost", port=64153)

trayicon = None

def exit():
	trayicon.stop()

traymenu = pystray.Menu(
	pystray.MenuItem("Exit", action=exit)
)

trayimage = Image.open("./testicon.png")

trayicon = pystray.Icon("ovrtk_sp", title="OVR Toolkit Soundpad Bridge", menu=traymenu)
trayicon.icon = trayimage

def main(icon):
	icon.visible = True

if __name__ == '__main__':
	signal.signal(signal.SIGINT, signal.SIG_DFL)
	trayicon.run(setup=main)