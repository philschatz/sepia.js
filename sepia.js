(function() {
  var SepiaXMLHttpRequest, applyMatchingFilters, constructAndCreateFixtureFolder, constructFilename, filterByWhitelist, gatherFilenameHashParts, globalOptions, parseCookiesNames, parseHeaderNames, parseUrl, removeInternalHeaders, sepia, urlParser, usesGlobalFixtures, writeBodyFile, writeHeaderFile;

  sepia = this.sepia != null ? this.sepia : this.sepia = {
    isRecord: false,
    isPlayback: true
  };

  sepia.rootDir = function(path) {
    return globalOptions.rootPrefix = path;
  };

  sepia.fixtureDir = function(path) {
    return globalOptions.filenamePrefix = path;
  };

  sepia.start = function() {
    return window.XMLHttpRequest = sepia.SepiaXMLHttpRequest;
  };

  sepia.stop = function() {
    return window.XMLHttpRequest = sepia.OriginalXMLHttpRequest;
  };

  sepia.OriginalXMLHttpRequest = this.XMLHttpRequest;

  urlParser = document.createElement('a');

  parseUrl = function(url) {
    urlParser.href = url;
    return urlParser;
  };

  sepia.SepiaXMLHttpRequest = SepiaXMLHttpRequest = (function() {
    function SepiaXMLHttpRequest() {}

    SepiaXMLHttpRequest.prototype._headers = {};

    SepiaXMLHttpRequest.prototype._resHeaders = {};

    SepiaXMLHttpRequest.prototype.readyState = -1;

    SepiaXMLHttpRequest.prototype.status = -1;

    SepiaXMLHttpRequest.prototype.open = function(_type, url) {
      var parser, port;
      this._type = _type;
      parser = parseUrl(url);
      port = parser.port;
      if (!port && parser.protocol === 'http:') {
        port = 80;
      }
      if (!port && parser.protocol === 'https:') {
        port = 443;
      }
      return this._url = "" + parser.protocol + "//" + parser.hostname + ":" + port + parser.pathname + parser.search;
    };

    SepiaXMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      return this._headers[name] = value;
    };

    SepiaXMLHttpRequest.prototype.onreadystatechange = function() {
      return console.error('BUG: Must implement onreadystatechange');
    };

    SepiaXMLHttpRequest.prototype.getResponseHeader = function(name) {
      var _ref;
      return this._resHeaders[name.toLowerCase()] || ((_ref = this._xhr) != null ? _ref.getResponseHeader(name) : void 0);
    };

    SepiaXMLHttpRequest.prototype.send = function(data) {
      var body, filename, finish, headers, method, name, remainingAsyncCalls, reqBody, reqHeaders, reqUrl, value, xhrBody, xhrHeader, _base, _base1, _ref, _ref1,
        _this = this;
      if (data == null) {
        data = '';
      }
      if (data === '{}') {
        data = '';
      }
      method = this._type;
      reqUrl = this._url;
      reqBody = data;
      reqHeaders = this._headers;
      if ((_base = this._headers)['User-Agent'] == null) {
        _base['User-Agent'] = 'octokit';
      }
      if ((_base1 = this._headers)['Host'] == null) {
        _base1['Host'] = parseUrl(reqUrl).hostname;
      }
      if (data.length) {
        this._headers['Content-Length'] = data.length;
      }
      if (!data.length) {
        delete this._headers['Content-Length'];
      }
      if (this._type.toLowerCase() === 'get') {
        delete this._headers['Content-Type'];
      }
      delete this._headers['If-None-Match'];
      filename = constructFilename(method, reqUrl, reqBody, reqHeaders);
      if (sepia.isRecord) {
        this._xhr = new sepia.OriginalXMLHttpRequest();
        this._xhr.open(this._type, this._url);
        this._xhr.onreadystatechange = function() {
          var header, name, value, _i, _len, _ref, _ref1;
          _this.status = _this._xhr.status;
          _this.response = _this._xhr.response;
          _this.responseText = _this._xhr.responseText;
          _this.readyState = _this._xhr.readyState;
          if (4 === _this._xhr.readyState) {
            _this._resHeaders = {};
            _ref = _this._xhr.getAllResponseHeaders().split('\n');
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              header = _ref[_i];
              _ref1 = header.split(':'), name = _ref1[0], value = _ref1[1];
              _this._resHeaders[name] = value;
            }
            writeHeaderFile(method, reqUrl, reqHeaders, filename, _this._resHeaders);
            writeBodyFile(filename, _this._xhr.response);
          }
          return _this.onreadystatechange();
        };
        _ref = this._headers;
        for (name in _ref) {
          value = _ref[name];
          if ((_ref1 = name.toLowerCase()) === 'host' || _ref1 === 'user-agent' || _ref1 === 'content-length') {
            console.log("Skipping the setting of unsafe header " + name);
          } else {
            this._xhr.setRequestHeader(name, value);
          }
        }
        this._xhr.send(data);
      }
      if (sepia.isPlayback) {
        headers = null;
        body = null;
        remainingAsyncCalls = 2;
        finish = function() {
          _this.status = headers.statusCode;
          _this._resHeaders = headers.headers;
          _this.response = body;
          _this.responseText = body;
          _this.readyState = 4;
          return _this.onreadystatechange();
        };
        xhrHeader = new sepia.OriginalXMLHttpRequest();
        xhrHeader.open('get', "" + filename + ".headers");
        xhrHeader.onreadystatechange = function() {
          if (4 === xhrHeader.readyState) {
            if (xhrHeader.status >= 200 && xhrHeader.status < 300 || xhrHeader.status === 304) {
              headers = JSON.parse(xhrHeader.response);
            } else {
              console.error('Hash header file not found');
            }
            remainingAsyncCalls -= 1;
            if (!remainingAsyncCalls) {
              return finish();
            }
          }
        };
        xhrHeader.send();
        xhrBody = new sepia.OriginalXMLHttpRequest();
        xhrBody.open('get', filename);
        xhrBody.onreadystatechange = function() {
          if (4 === xhrBody.readyState) {
            if (xhrBody.status >= 200 && xhrBody.status < 300 || xhrBody.status === 304) {
              body = xhrBody.response;
            } else {
              console.error('Hash body file not found');
            }
            remainingAsyncCalls -= 1;
            if (!remainingAsyncCalls) {
              return finish();
            }
          }
        };
        return xhrBody.send();
      }
    };

    return SepiaXMLHttpRequest;

  })();

  writeHeaderFile = function(reqMethod, reqUrl, reqHeaders, filename, headers) {
    var obj;
    headers.url = reqUrl;
    headers.time = 0;
    headers.request = {
      method: reqMethod,
      headers: reqHeaders
    };
    obj = {
      filename: filename + ".headers",
      body: JSON.stringify(headers, null, 2)
    };
    if (window.PHANTOMJS) {
      return alert(JSON.stringify(obj));
    } else {
      return console.log(obj);
    }
  };

  writeBodyFile = function(filename, body) {
    var obj;
    obj = {
      filename: filename,
      body: body
    };
    if (window.PHANTOMJS) {
      return alert(JSON.stringify(obj));
    } else {
      return console.log(obj);
    }
  };

  globalOptions = {};

  globalOptions.rootPrefix = '/';

  globalOptions.filenamePrefix = 'fixtures/generated';

  globalOptions.filenameFilters = [];

  globalOptions.includeHeaderNames = true;

  globalOptions.headerWhitelist = [];

  globalOptions.includeCookieNames = true;

  globalOptions.cookieWhitelist = [];

  globalOptions.verbose = false;

  globalOptions.touchHits = true;

  globalOptions.debug = false;

  globalOptions.testOptions = {};

  filterByWhitelist = function(list, whitelist) {
    if (whitelist.length === 0) {
      return list;
    }
    return list.filter(function(item) {
      return whitelist.indexOf(item) >= 0;
    });
  };

  removeInternalHeaders = function(headers) {
    var filtered, key;
    if (!headers) {
      return;
    }
    filtered = {};
    for (key in headers) {
      if (key.indexOf("x-sepia-") !== 0) {
        filtered[key] = headers[key];
      }
    }
    return filtered;
  };

  parseHeaderNames = function(headers) {
    var headerNames, name;
    headers = removeInternalHeaders(headers);
    headerNames = [];
    for (name in headers) {
      if (headers.hasOwnProperty(name)) {
        headerNames.push(name.toLowerCase());
      }
    }
    headerNames = filterByWhitelist(headerNames, globalOptions.headerWhitelist);
    return headerNames.sort();
  };

  parseCookiesNames = function(cookieValue) {
    var ary, cookies;
    cookies = [];
    if (!cookieValue || cookieValue === "") {
      return cookies;
    }
    ary = cookieValue.toString().split(/;\s+/);
    ary.forEach(function(ck) {
      var parsed;
      ck = ck.trim();
      if (ck !== "") {
        parsed = ck.split("=")[0];
        if (parsed && parsed !== "") {
          cookies.push(parsed.toLowerCase().trim());
        }
      }
    });
    cookies = filterByWhitelist(cookies, globalOptions.cookieWhitelist);
    return cookies.sort();
  };

  applyMatchingFilters = function(reqUrl, reqBody) {
    var filteredBody, filteredUrl;
    filteredUrl = reqUrl;
    filteredBody = reqBody;
    globalOptions.filenameFilters.forEach(function(filter) {
      if (filter.url.test(reqUrl)) {
        filteredUrl = filter.urlFilter(filteredUrl);
        filteredBody = filter.bodyFilter(filteredBody);
      }
    });
    return {
      filteredUrl: filteredUrl,
      filteredBody: filteredBody
    };
  };

  gatherFilenameHashParts = function(method, reqUrl, reqBody, reqHeaders) {
    var cookieNames, filtered, headerNames;
    method = (method || "get").toLowerCase();
    reqHeaders = reqHeaders || {};
    filtered = applyMatchingFilters(reqUrl, reqBody);
    headerNames = [];
    if (globalOptions.includeHeaderNames) {
      headerNames = parseHeaderNames(reqHeaders);
    }
    cookieNames = [];
    if (globalOptions.includeCookieNames) {
      cookieNames = parseCookiesNames(reqHeaders.cookie);
    }
    return [["method", method], ["url", filtered.filteredUrl], ["body", filtered.filteredBody], ["headerNames", headerNames], ["cookieNames", cookieNames]];
  };

  usesGlobalFixtures = function(reqUrl) {
    return globalOptions.filenameFilters.some(function(filter) {
      return filter.global && filter.url.test(reqUrl);
    });
  };

  constructAndCreateFixtureFolder = function(reqUrl, reqHeaders) {
    var folder, language, testFolder;
    reqHeaders = reqHeaders || {};
    language = reqHeaders["accept-language"] || "";
    language = language.split(",")[0];
    testFolder = "";
    if (!usesGlobalFixtures(reqUrl)) {
      if (reqHeaders["x-sepia-test-name"]) {
        testFolder = reqHeaders["x-sepia-test-name"];
      } else {
        if (globalOptions.testOptions.testName) {
          testFolder = globalOptions.testOptions.testName;
        }
      }
    }
    folder = "" + globalOptions.rootPrefix + globalOptions.filenamePrefix + "/" + language + "/" + testFolder;
    return folder;
  };

  constructFilename = function(method, reqUrl, reqBody, reqHeaders) {
    var filename, folder, hashFile, hashParts;
    hashParts = gatherFilenameHashParts(method, reqUrl, reqBody, reqHeaders);
    filename = CryptoJS.MD5(JSON.stringify(hashParts)).toString();
    folder = constructAndCreateFixtureFolder(reqUrl, reqHeaders);
    hashFile = "" + folder + "/" + filename;
    return hashFile;
  };

}).call(this);