class_name SaveArchive
extends RefCounted
const MAGIC: String="RIMTOWN1"
const LIMIT: int=64*1024*1024
const HEADER: int=48
static func digest(bytes: PackedByteArray) -> PackedByteArray:
	var h:=HashingContext.new();h.start(HashingContext.HASH_SHA256);h.update(bytes);return h.finish()
static func encode(text: String) -> PackedByteArray:
	var raw:=text.to_utf8_buffer()
	if raw.is_empty() or raw.size()>LIMIT: return PackedByteArray()
	var result:=MAGIC.to_utf8_buffer();result.resize(16);result.encode_u64(8,raw.size());result.append_array(digest(raw));result.append_array(raw.compress(FileAccess.COMPRESSION_GZIP));return result if result.size()<=LIMIT else PackedByteArray()
static func decode(bytes: PackedByteArray) -> Dictionary:
	if bytes.is_empty() or bytes.size()>LIMIT: return {"ok":false,"error":"存檔為空或超過 64 MB 上限。"}
	if bytes.slice(0,8)!=MAGIC.to_utf8_buffer():
		if bytes.slice(0,7)=="RIMTOWN".to_utf8_buffer(): return {"ok":false,"error":"不支援的壓縮存檔版本。"}
		return {"ok":true,"text":bytes.get_string_from_utf8()}
	if bytes.size()<=HEADER: return {"ok":false,"error":"壓縮存檔不完整。"}
	var size:=bytes.decode_u64(8)
	if size<=0 or size>LIMIT: return {"ok":false,"error":"解壓後存檔超過 64 MB 上限或長度無效。"}
	var raw:=bytes.slice(HEADER).decompress(size,FileAccess.COMPRESSION_GZIP)
	if raw.size()!=size or digest(raw)!=bytes.slice(16,HEADER): return {"ok":false,"error":"存檔完整性檢查失敗，請使用其他備份。"}
	return {"ok":true,"text":raw.get_string_from_utf8()}
static func write_new(path: String,bytes: PackedByteArray) -> bool:
	var temp:=path+".writing"
	if bytes.is_empty() or FileAccess.file_exists(path) or FileAccess.file_exists(temp): return false
	var f:=FileAccess.open(temp,FileAccess.WRITE)
	if f==null: return false
	f.store_buffer(bytes);f.flush();var ok:=f.get_error()==OK;f.close()
	if not ok or FileAccess.get_file_as_bytes(temp)!=bytes:
		DirAccess.remove_absolute(temp);return false
	if FileAccess.file_exists(path) or DirAccess.rename_absolute(temp,path)!=OK:
		DirAccess.remove_absolute(temp);return false
	return true
