from soundpad_remote import SoundpadRemote
import xml.etree.ElementTree as ET
import hashlib, datetime
from threading import Thread, Event, Lock

from sanic.log import logger

class SoundpadManager(Thread):
	def __init__(self):
		Thread.__init__(self)
		self._remote = SoundpadRemote()

		self._stop_event = Event()
		self._sl_lock = Lock()

		self._soundlist = {}
		self._lastSLupdate = None

	def run(self):
		self._stop_event.clear()

		while not self._stop_event.is_set():
			if not self._remote.initialized():
				self.try_init()

			if self._lastSLupdate is None or (datetime.datetime.now() - self._lastSLupdate).total_seconds() > 10:
				self._updateSoundlist()

			self._stop_event.wait(5) # update every 5 sec

	def stop(self):
		self._stop_event.set()

	def try_init(self):
		try:
			self._remote.init()
			self._lastSLupdate = None
		except:
			pass

	def is_initialized(self):
		return self._remote.initialized()

	def _updateSoundlist(self):
		if not self._remote.initialized():
			return

		self._sl_lock.acquire()

		# print("update")

		try:
			soundlist_xml = self._remote.getSoundList()
		except Exception as err:
			logger.error(f"Error while parsing soundlist: {repr(err)}")
			return
		else:
			root = ET.fromstring(soundlist_xml)

			for sound in root.iter("Sound"):
				if sound.tag == "Sound":
					sound_id = hashlib.sha1(str.encode(f"{sound.attrib['title']}")).hexdigest()

					self._soundlist[sound_id] = { 
						"index": sound.attrib["index"],
						"title": sound.attrib["title"],
						"duration": sound.attrib["duration"],
					}

			self._lastSLupdate = datetime.datetime.now()
		finally: # always run this
			self._sl_lock.release()

	def playSound(self, sound_id):
		if not sound_id in self._soundlist:
			return

		idx = self._soundlist[sound_id]["index"]
		self._remote.playSound(idx)

	def getSoundList(self):
		try:
			self._sl_lock.acquire()
			return self._soundlist
		finally:
			self._sl_lock.release()