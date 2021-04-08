from soundpad_remote import SoundpadRemote
import xml.etree.ElementTree as ET
import hashlib, datetime

from sanic.log import logger

class SoundpadManager:
	def __init__(self):
		self._remote = SoundpadRemote()

		self._soundlist = {}
		self._lastSLupdate = None

	def start(self):
		self._lastSLupdate = None
		self._remote.init()

	def _updateSoundlist(self):
		if not self._remote.initialized():
			return

		try:
			soundlist_xml = self._remote.getSoundList()
		except err:
			logger.error(f"Error while parsing soundlist: {repr(err)}")
			return

		root = ET.fromstring(soundlist_xml)

		for sound in root.iter("Sound"):
			if sound.tag == "Sound":
				sound_id = hashlib.sha1(str.encode(f"{sound.attrib['title']}")).digest()

				self._soundlist[sound_id] = { 
					"index": sound.attrib["index"],
					"title": sound.attrib["title"],
					"duration": sound.attrib["duration"],
				}

		self._lastSLupdate = datetime.datetime.now()

	def getSoundList(self):
		if self._lastSLupdate is None or (datetime.datetime.now() - self._lastSLupdate).total_seconds() > 10:
			self._updateSoundlist()

		return self._soundlist