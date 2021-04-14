from threading import Lock
import win32file, pywintypes

class NoPipeError(Exception):
	def __init__(self):
		super().__init__("Not Found")

class BrokenPipeError(Exception):
	def __init__(self):
		super().__init__("Broken Pipe")

class SoundpadRemote:
	def __init__(self):
		self._handle = None
		self._request_lock = Lock()

	def init(self):
		if self._handle is not None:
			raise Exception("Remote is already initialized")

		try:
			self._handle = win32file.CreateFile(
				r'\\.\pipe\sp_remote_control',
				win32file.GENERIC_READ | win32file.GENERIC_WRITE,
				0,
				None,
				win32file.OPEN_EXISTING,
				0,
				None
			)
		except pywintypes.error as e:
			if e.args[0] == 2:
				raise NoPipeError() from e
			elif e.args[0] == 109:
				raise BrokenPipeError() from e
			else:
				raise e # just re-raise the same error

	def deinit(self):
		if self._handle is not None:
			win32file.CloseHandle(self._handle)

		self._handle = None

	def initialized(self):
		return self._handle is not None

	def _sendRequest(self, request):
		self._request_lock.acquire()

		if self._handle is None:
			raise Exception("Remote is not initialized")

		try:
			win32file.WriteFile(self._handle, str.encode(request))

			bufSize = 4096
			win32file.SetFilePointer(self._handle, 0, win32file.FILE_BEGIN)
			result, data = win32file.ReadFile(self._handle, bufSize, None) 
			buf = data
			while len(data) == bufSize:            
				result, data = win32file.ReadFile(self._handle, bufSize, None)
				buf += data
			return buf

		except pywintypes.error as e:
			if e.args[0] == 233:
				self.deinit()
			raise e

		finally:
			self._request_lock.release()

	def playSound(self, index, playSpeakers=True, playMic=True):
		resp = self._sendRequest(f"DoPlaySound({index}, {playSpeakers}, {playMic})")

		if not resp.startswith(b"R-200"):
			raise Exception(str(resp, "ascii"))

		return True

	def getSoundList(self):
		resp = self._sendRequest("GetSoundlist()")

		if resp.startswith(b"R-"):
			raise Exception(str(resp, "ascii"))

		return str(resp, "ascii")