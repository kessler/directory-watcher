var log = require('log4js').getLogger('DirectoryWatcher');
var events = require('events');
var fs = require('fs');
var $u = require('util');
var _u = require('underscore');

function DirectoryWatcher(path, initCallback) {

	var self = this;

	fs.readdir(path, function(err, files) {

		if (err === null) {
			
			self.path = path;			
			self.files = files;

		} else {
		
			log.error('failed to read files due to an error', err);
		}
		
		if (initCallback)
			initCallback(err, self);	
	});
}

$u.inherits(DirectoryWatcher, events.EventEmitter);

// factory that creates a watcher using the fs.watch api (instead of fs.watchFile)
DirectoryWatcher.create = function(path, cb) {
	new DirectoryWatcher(path, function(err, watcher) {
		if (err !== null) {
			cb(err);
		} else {
			watcher._internalFSWatcher = fs.watch(path, watcher.listener(), { persistent: false });
			cb(null, watcher);
		}
	});
};

// creates a watcher without attaching it to an underlying mechanism
DirectoryWatcher.createEx = function(path, cb) {
	new DirectoryWatcher(path, cb);
};

DirectoryWatcher.prototype.listener = function() {
	var self = this;

	return function(event, filename) {	
		self._onWatchEvent(event, filename);				
	};
};

DirectoryWatcher.prototype.kill = function () {
	if (this._internalFSWatcher) {		
		this._internalFSWatcher.close()
		this._internalFSWatcher = undefined;		
	} 

	this.files = [];
};

DirectoryWatcher.prototype._onWatchEvent = function(event, filename) {

	if (event === 'rename') {
		this._onRenameEvent(filename);
	} else if (event === 'change') {
		this._onChangeEvent(filename);
	} else {
		log.warn('Unknown event from file watcher', event);
	}

};

DirectoryWatcher.prototype._onRenameEvent = function (filename) {
	
	var self = this;
	
	if (typeof(filename) === 'undefined' || filename === null) {
		
		log.debug('rename event, no filename was supplied, will do diff on directory');

		fs.readdir(self.path, function(err, files) {			
			
			var deleted = _u.difference(self.files, files);
			var added = _u.difference(files, self.files);

			if (deleted.length > 0) {				
				log.debug('deleted: %s', deleted);
				self.files = files;
				self.emit('deleted', deleted);								
			}

			if (added.length > 0) {				
				log.debug('added: %s', added);
				self.files = self.files.concat(added);
				self.emit('added', added);			
			}

		});

	} else {
		
		log.debug('rename event for file %s', filename);

		var index = self.files.indexOf(filename);

		// file was deleted
		if (index >= 0) {

			self.files = self.files.splice(index, 1);
			self.emit('deleted', [filename]);

		// file was added
		} else {

			self.files.push(filename);
			self.emit('added', [filename]);
		} 
	}
};

DirectoryWatcher.prototype._onChangeEvent = function(filename) {
	var self = this;

	if (typeof(filename) === 'undefined' || filename === null) {
		//TODO: must implement a solution to this
		log.warn('filename was not supplied by underlying implementation / OS so a change event will not be fired');

	} else {
		log.debug('change event for file %s', filename);
		self.emit('changed', [filename]);
	}
};

module.exports = DirectoryWatcher;