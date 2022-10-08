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
			pass # do nothing if we can't initialize, just try again

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

	def stopSound(self):
		self._remote.stopSound()

	def pauseSound(self):
		self._remote.togglePause()

	def getCategories(self):
		if not self._remote.initialized():
			return

		self._sl_lock.acquire()

		try:
			categories_xml = self._remote.getCategories(withSounds=True)
		except Exception as err:
			logger.error(f"Error while parsing categories: {repr(err)}")
			return
		else:
			root = ET.fromstring(categories_xml)

			result = []

			for category in root.iter("Category"):
				if category.tag == "Category":
					hidden = (category.attrib["hidden"] == "true") if "hidden" in category.attrib else False

					if hidden:
						continue

					current_cat = {
						"name": category.attrib["name"],
						"sounds": [],
					}

					for sound in category.iter("Sound"):
						sound_id = hashlib.sha1(str.encode(f"{sound.attrib['title']}")).hexdigest()
						current_cat["sounds"].append(sound_id)

					result.append(current_cat)

			return result
		finally:
			self._sl_lock.release()