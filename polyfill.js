/**
 * Angular polyfill for Directory Upload Proposal.
 *
 * Polyfill orginally written by Ali Alabbas (Microsoft).
 */

'use strict';

angular.module('dirUpload', [])

/**
 * Directive that handles actually converting the inputs.
 */
.directive('directory', ['$log', function($log) {
    // Do not proceed with the polyfill if Directory interface is already natively available,
    // or if webkitdirectory is not supported (i.e. not Chrome, since the polyfill only works in Chrome)
    if (window.Directory || !('webkitdirectory' in document.createElement('input'))) {
        return {};
    }
  
	var directoryAttr = 'directory',
		getFilesMethod = 'getFilesAndDirectories',
		isSupportedProp = 'isFilesAndDirectoriesSupported',
		chooseDirMethod = 'chooseDirectory';

	var separator = '/';

	var Directory = function() {
		this.name = '';
		this.path = separator;
		this._children = {};
		this._items = false;
	};

	Directory.prototype[getFilesMethod] = function() {
		var that = this;

		// from drag and drop and file input drag and drop (webkitEntries)
		if (this._items) {
			var getItem = function(entry) {
				if (entry.isDirectory) {
					var dir = new Directory();
					dir.name = entry.name;
					dir.path = entry.fullPath;
					dir._items = entry;

					return dir;
				} else {
					return new Promise(function(resolve, reject) {
						entry.file(function(file) {
							resolve(file);
						}, reject);
					});
				}
			};

			if (this.path === separator) {
				var promises = [];
				
				for (var i = 0; i < this._items.length; i++) {
					var entry;

					// from file input drag and drop (webkitEntries)
					if (this._items[i].isDirectory || this._items[i].isFile) {
						entry = this._items[i];
					} else {
						entry = this._items[i].webkitGetAsEntry();
					}
					
					promises.push(getItem(entry));
				}

				return Promise.all(promises);
			} else {
				return new Promise(function(resolve, reject) {
					that._items.createReader().readEntries(function(entries) {
						var promises = [];

						for (var i = 0; i < entries.length; i++) {
							var entry = entries[i];

							promises.push(getItem(entry));
						}
						
						resolve(Promise.all(promises));
					}, reject);
				});
			}
		// from file input manual selection
		} else {
			var arr = [];

			for (var child in this._children) {
				arr.push(this._children[child]);
			}

			return Promise.resolve(arr);
		}
	};

	// set blank as default for all inputs
	HTMLInputElement.prototype[getFilesMethod] = function() {
		return Promise.resolve([]);
	};

	// if OS is Mac, the combined directory and file picker is supported
	HTMLInputElement.prototype[isSupportedProp] = navigator.appVersion.indexOf("Mac") !== -1;

	HTMLInputElement.prototype[directoryAttr] = undefined;
	HTMLInputElement.prototype[chooseDirMethod] = undefined;

	// expose Directory interface to window
	window.Directory = Directory;

	/********************
	 **** File Input ****
	 ********************/
	var convertInput = function(node) {
		var recurse = function(dir, path, fullPath, file) {
			var pathPieces = path.split(separator);
			var dirName = pathPieces.shift();

			if (pathPieces.length > 0) {
				var subDir = new Directory();
				subDir.name = dirName;
				subDir.path = separator + fullPath;

				if (!dir._children[subDir.name]) {
					dir._children[subDir.name] = subDir;
				}

				recurse(dir._children[subDir.name], pathPieces.join(separator), fullPath, file);
			} else {
				dir._children[file.name] = file;
			}
		};

		var handleNode = function(node) {

			if (node.tagName === 'INPUT' && node.type === 'file') {
				// force multiple selection for default behavior
				if (!node.hasAttribute('multiple')) {
					node.setAttribute('multiple', '');
				}

				var shadow = node.createShadowRoot();

				node[chooseDirMethod] = function() {
					// can't do this without an actual click
					console.log('This is unsupported. For security reasons the dialog cannot be triggered unless it is a response to some user triggered event such as a click on some other element.');
				};

				shadow.innerHTML = '<div style="border: 1px solid #999; padding: 3px; width: 235px; box-sizing: content-box; font-size: 14px; height: 21px;">'
					+ '<div id="fileButtons" style="box-sizing: content-box;">'
					+ '<button id="button1" style="width: 100px; box-sizing: content-box;">Choose file(s)...</button>'
					+ '<button id="button2" style="width: 100px; box-sizing: content-box; margin-left: 3px;">Choose folder...</button>'
					+ '</div>'
					+ '<div id="filesChosen" style="padding: 3px; display: none; box-sizing: content-box;"><span id="filesChosenText">files selected...</span>'
					+ '<a id="clear" title="Clear selection" href="javascript:;" style="text-decoration: none; float: right; margin: -3px -1px 0 0; padding: 3px; font-weight: bold; font-size: 16px; color:#999; box-sizing: content-box;">&times;</a>'
					+ '</div>'
					+ '</div>'
					+ '<input id="input1" type="file" multiple style="display: none;">'
					+ '<input id="input2" type="file" webkitdirectory style="display: none;">'
					+ '</div>';

				shadow.querySelector('#button1').onclick = function(e) {
					e.preventDefault();
					
					shadow.querySelector('#input1').click();
				};

				shadow.querySelector('#button2').onclick = function(e) {
					e.preventDefault();
					
					shadow.querySelector('#input2').click();
				};

				var toggleView = function(defaultView, filesLength) {
					shadow.querySelector('#fileButtons').style.display = defaultView ? 'block' : 'none';
					shadow.querySelector('#filesChosen').style.display = defaultView ? 'none' : 'block';
					
					if (!defaultView) {
						shadow.querySelector('#filesChosenText').innerText = filesLength + ' file' + (filesLength > 1 ? 's' : '') + ' selected...';
					}
				};

				var draggedAndDropped = false;

				var getFiles = function() {
					var files = node.files;

					if (draggedAndDropped) {
						files = node.webkitEntries;
						draggedAndDropped = false;
					} else {
						if (files.length === 0) {
							files = node.shadowRoot.querySelector('#input1').files;

							if (files.length === 0) {
								files = node.shadowRoot.querySelector('#input2').files;

								if (files.length === 0) {
									files = node.webkitEntries;
								}
							}
						}
					}

					return files;
				};

				var changeHandler = function(e) {
					node.dispatchEvent(new Event('change'));

					toggleView(false, getFiles().length);
				};

				shadow.querySelector('#input1').onchange = shadow.querySelector('#input2').onchange = changeHandler;

				var clear = function (e) {
					toggleView(true);

					var form = document.createElement('form');
					node.parentNode.insertBefore(form, node);
					node.parentNode.removeChild(node);
					form.appendChild(node);
					form.reset();

					form.parentNode.insertBefore(node, form);
					form.parentNode.removeChild(form);

					// reset does not instantly occur, need to give it some time
					setTimeout(function() {
						node.dispatchEvent(new Event('change'));
					}, 1);
				};

				shadow.querySelector('#clear').onclick = clear;

				node.addEventListener('drop', function(e) {
					draggedAndDropped = true;
				}, false);

				node.addEventListener('change', function() {
					var dir = new Directory();

					var files = getFiles();

					if (files.length > 0) {
						toggleView(false, files.length);

						// from file input drag and drop (webkitEntries)
						if (files[0].isFile || files[0].isDirectory) {
							dir._items = files;
						} else {
							for (var j = 0; j < files.length; j++) {
								var file = files[j];
								var path = file.webkitRelativePath;
								var fullPath = path.substring(0, path.lastIndexOf(separator));

								recurse(dir, path, fullPath, file);
							}
						}
					} else {
						toggleView(true, files.length);
					}

					this[getFilesMethod] = function() {
						return dir[getFilesMethod]();
					};
				});
			}
		};

        handleNode(node);
	};

	/***********************
	 **** Drag and drop ****
	 ***********************/
	// keep a reference to the original method
	var _addEventListener = Element.prototype.addEventListener;

	DataTransfer.prototype[getFilesMethod] = function() {
		return Promise.resolve([]);
	};

	Element.prototype.addEventListener = function(type, listener, useCapture) {
		if (type === 'drop') {
			var _listener = listener;

			listener = function(e) {
				var dir = new Directory();
				dir._items = e.dataTransfer.items;

				e.dataTransfer[getFilesMethod] = function() {
					return dir[getFilesMethod]();
				};

				_listener(e);
			};
		}

		// call the original method
		return _addEventListener.apply(this, arguments);
	};

    return {
        // This needs to run BEFORE the fileChange directive.
        // NOTE: Post-link priorites are reversed.
        priority: 10,
        restrict: 'A',
        link: function (scope, element, attrs) {
            $log.info("Converting input");
            $log.info(element[0]);
            convertInput(element[0]);
        }
    };
}])

/**
 * Convenience directive that will monitor a file input for changes.
 */
.directive('fileChange', ['$log', function($log) {
    return {
        // This needs to run AFTER the directory directive.
        // NOTE: Post-link priorites are reversed.
        priority: 20,
        restrict: 'A',
        link: function (scope, element, attrs) {
            $log.info("Applying fileChange listener");
            var onChangeHandler = scope.$eval(attrs.fileChange);
            element.bind('change', onChangeHandler);
        }
    };
}]);
