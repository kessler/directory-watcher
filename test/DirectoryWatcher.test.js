var log = require('log4js').getLogger('DirectoryWatcher.test');
var vows = require('vows');
var assert = require('assert');
var DirectoryWatcher = require('../lib/DirectoryWatcher');
var $u = require('util');
var fs = require('fs');

var TEST_DIR = './DirectoryWatcherTestDir';

function setupTestDirectory() {	
	if (fs.existsSync(TEST_DIR))
		cleanup();

	fs.mkdirSync(TEST_DIR);
}

function writeTestFile(name) {	
	fs.writeFileSync(TEST_DIR + '/' + name, 'alert("' + name + '");');
}

function deleteTestFile(name) {
	fs.unlinkSync(TEST_DIR + '/' + name);
}

function cleanup () { 	
	
	var files = fs.readdirSync(TEST_DIR);

	for (var i = 0, len = files.length; i < len; i++)
	    if (files[i] !== '.' && files[i] !== '..')
	        fs.unlinkSync(TEST_DIR + '/' + files[i]);

	fs.rmdirSync(TEST_DIR);
}	

setupTestDirectory();
writeTestFile('1.js');

var suite = vows.describe('DirectoryWatcher').addBatch({

	'When created, loads a list of files in the directory': {
		topic: function() {			
			
			DirectoryWatcher.create(TEST_DIR, this.callback);			
			
		},						
		'check expected files are there': function(err, watcher) {			
			
			if (err !== null)
				assert.fail(err);

			assert.isArray(watcher.files);
			assert.include(watcher.files, '1.js');	
			watcher.kill();		
		
		}
	}

});

suite.addBatch({
	'_onRenameEvent called with no filename': {
		topic: function() {
			try {
				this.watcher = new DirectoryWatcher(TEST_DIR, this.callback);
			} catch (e) {
				log.info(e);
			}
		},
		'watcher created': function(err, watcher) {
			if (err !== null)
				assert.fail(err);

			assert.instanceOf(watcher, DirectoryWatcher);
		},
		'when files are added': {
			topic: function(watcher) {				
				
				writeTestFile('3.js');
				writeTestFile('4.js');			

				this.watcher.once('added', this.callback);
				this.watcher._onRenameEvent(null);				
			},
			'examine all files in the directory to find diff': function(addedFiles) {
				
				assert.instanceOf(addedFiles, Array);
				assert.lengthOf(addedFiles, 2);
				assert.include(addedFiles, '3.js');
				assert.include(addedFiles, '4.js');
			},
			'and when files are deleted': {

				topic: function(addedFiles) {				
					
					var deletedFile = addedFiles[0];
					
					log.info('deleting %s', deletedFile);

					deleteTestFile(deletedFile);

					var watcher = this.watcher;
					var callback = this.callback;

					watcher.once('deleted', function(deletedFiles) {
						callback(watcher, deletedFile, deletedFiles);
					});

					watcher._onRenameEvent(null);					
				},
				'examine all files in the directory to find diff': function(watcher, deletedFile, deletedFiles) {
					
					assert.instanceOf(deletedFiles, Array);
					assert.lengthOf(deletedFiles, 1);

					assert.include(deletedFiles, deletedFile);
					assert.include(watcher.files, '4.js');
					assert.include(watcher.files, '1.js');

				},
				teardown: function(watcher) {
					watcher.kill();
				}
			}
		}		
	}
});

suite.addBatch({
	'test _onRenameEvent called with a filename': {
		topic: function() {

			DirectoryWatcher.create(TEST_DIR, this.callback);	
		},
		'watcher created': function(err, watcher) {

			if (err !== null)
				assert.fail(err);

			assert.instanceOf(watcher, DirectoryWatcher);
		},
		'when files are added': {
			topic: function(err, watcher) {				
				
				watcher.once('added', this.callback);
				writeTestFile('5.js');
				writeTestFile('6.js');

			},
			'verify correct file': function(addedFiles) {
				assert.instanceOf(addedFiles, Array);
				assert.lengthOf(addedFiles, 1);
				assert.include(addedFiles, '5.js');
			}
		},
		'when files are deleted': {
			topic: function(err, watcher) {				
				var self = this;
				watcher.once('deleted', function(deletedFiles) {
					self.callback(watcher, deletedFiles);
				});

				deleteTestFile('6.js');
				
			},
			'verify correct file': function(watcher, deletedFiles) {
			
				assert.instanceOf(deletedFiles, Array);
				assert.lengthOf(deletedFiles, 1);
				assert.include(deletedFiles, '6.js');
			},
			teardown: function(watcher) {
				watcher.kill();
			}
		}
	}
});

suite.options.error =false;

process.on('exit', function () {
	cleanup();
});

suite.export(module);
