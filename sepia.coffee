sepia = @sepia ?=
  isRecord: false
  isPlayback: true

sepia.rootDir = (path) ->
  globalOptions.rootPrefix = path

sepia.fixtureDir = (path) ->
  globalOptions.filenamePrefix = path

sepia.start = () ->
  window.XMLHttpRequest = sepia.SepiaXMLHttpRequest

sepia.stop = () ->
  window.XMLHttpRequest = sepia.OriginalXMLHttpRequest


sepia.OriginalXMLHttpRequest = @XMLHttpRequest


urlParser = document.createElement('a')
parseUrl = (url) ->
  urlParser.href = url
  return urlParser


sepia.SepiaXMLHttpRequest = class SepiaXMLHttpRequest
  _headers: {}
  _resHeaders: {}
  readyState: -1
  status: -1
  # constructor: () ->

  open: (@_type, url) ->
    parser = parseUrl(url)
    # Use default ports for http and https if none provided
    port = parser.port
    port = 443
    port = 80   if not port and parser.protocol is 'http:'
    port = 443  if not port and parser.protocol is 'https:'

    @_url = "#{parser.protocol}//#{parser.hostname}:#{port}#{parser.pathname}#{parser.search}"
    @_headers = {}
    @_resHeaders = {}
    @readyState = -1
    @status = -1

  setRequestHeader: (name, value) ->
    @_headers[name] = value

  onreadystatechange: () -> console.error('BUG: Must implement onreadystatechange')

  getResponseHeader: (name) -> @_resHeaders[name.toLowerCase()] or @_xhr?.getResponseHeader(name)

  send: (data='') ->
    data = '' if data is '{}'

    method = @_type
    reqUrl = @_url
    reqBody = data
    reqHeaders = @_headers

    # Hack: add `octokit` as the UserAgent
    @_headers['User-Agent'] ?= 'octokit'
    @_headers['Host'] ?= parseUrl(reqUrl).hostname
    @_headers['Content-Length'] = data.length if data.length
    delete @_headers['Content-Length'] if not data.length
    delete @_headers['Content-Type'] if @_type.toLowerCase() is 'get'
    delete @_headers['If-None-Match']

    filename = constructFilename(method, reqUrl, reqBody, reqHeaders)

    if sepia.isRecord

      @_xhr = new sepia.OriginalXMLHttpRequest()
      @_xhr.open(@_type, @_url)
      @_xhr.onreadystatechange = () =>
        @status       = @_xhr.status
        @response     = @_xhr.response
        @responseText = @_xhr.responseText
        @readyState   = @_xhr.readyState

        if 4 == @_xhr.readyState
          # Squirrel the response

          @_resHeaders = {}
          for header in @_xhr.getAllResponseHeaders().split('\n')
            [name, value] = header.split(':')
            @_resHeaders[name] = value

          writeHeaderFile(method, reqUrl, reqHeaders, filename, @_resHeaders)
          writeBodyFile(filename, @_xhr.response)

        @onreadystatechange()

      for name, value of @_headers
        if name.toLowerCase() in ['host', 'user-agent', 'content-length']
          console.log("Skipping the setting of unsafe header #{name}")
        else
          @_xhr.setRequestHeader(name, value)

      @_xhr.send(data)

    if sepia.isPlayback

      headers = null
      body = null
      remainingAsyncCalls = 2

      finish = () =>
        @status = headers?.statusCode
        @_resHeaders = headers?.headers
        @response = body
        @responseText = body

        @readyState = 4
        @onreadystatechange()


      xhrHeader = new sepia.OriginalXMLHttpRequest()
      xhrHeader.open('get', "#{filename}.headers")
      xhrHeader.onreadystatechange = () ->
        if 4 == xhrHeader.readyState
          if xhrHeader.status >= 200 and xhrHeader.status < 300 or xhrHeader.status == 304
            headers = JSON.parse(xhrHeader.response)
          else
            console.error('Hash header file not found')
          remainingAsyncCalls -= 1
          finish() if not remainingAsyncCalls
      xhrHeader.send()

      xhrBody = new sepia.OriginalXMLHttpRequest()
      xhrBody.open('get', filename)
      xhrBody.onreadystatechange = () ->
        if 4 == xhrBody.readyState
          if xhrBody.status >= 200 and xhrBody.status < 300 or xhrBody.status == 304
            body = xhrBody.response
          else
            console.error('Hash body file not found')
          remainingAsyncCalls -= 1
          finish() if not remainingAsyncCalls
      xhrBody.send()



writeHeaderFile = (reqMethod, reqUrl, reqHeaders, filename, headers) ->
  # timeLength = Date.now() - startTime
  headers.url = reqUrl
  headers.time = 0
  headers.request =
    method: reqMethod   # options.method
    headers: reqHeaders # options.headers

  obj =
    filename: filename + ".headers"
    body: JSON.stringify(headers, null, 2)

  # Send through to PhantomJS
  if window.PHANTOMJS
    alert(JSON.stringify(obj))
  else
    console.log(obj)


writeBodyFile = (filename, body) ->
  obj =
    filename: filename
    body: body

  # Send through to PhantomJS
  if window.PHANTOMJS
    alert(JSON.stringify(obj))
  else
    console.log(obj)



# The rest are from `sepia/src/utils.js`

globalOptions = {}
globalOptions.rootPrefix = '/' # Used for browser tests that run in a different dir than the project root
globalOptions.filenamePrefix = 'fixtures/generated'
globalOptions.filenameFilters = []
globalOptions.includeHeaderNames = false
globalOptions.headerWhitelist = []
globalOptions.includeCookieNames = true
globalOptions.cookieWhitelist = []
globalOptions.verbose = false
# touch the cached file every time its used
globalOptions.touchHits = true
# debug support to find the best matching fixture
globalOptions.debug = false
# These test options are set via an HTTP request to the embedded HTTP server
# provided by sepia. The options are reset each time any of them are set.
globalOptions.testOptions = {}


filterByWhitelist = (list, whitelist) ->
  return list  if whitelist.length is 0
  list.filter (item) ->
    whitelist.indexOf(item) >= 0

removeInternalHeaders = (headers) ->
  return  unless headers
  filtered = {}
  for key of headers
    filtered[key] = headers[key]  if key.indexOf("x-sepia-") isnt 0
  filtered

parseHeaderNames = (headers) ->
  headers = removeInternalHeaders(headers)
  headerNames = []
  for name of headers
    headerNames.push name.toLowerCase()  if headers.hasOwnProperty(name)
  headerNames = filterByWhitelist(headerNames, globalOptions.headerWhitelist)
  headerNames.sort()


parseCookiesNames = (cookieValue) ->
  cookies = []
  return cookies  if not cookieValue or cookieValue is ""
  ary = cookieValue.toString().split(/;\s+/)
  ary.forEach (ck) ->
    ck = ck.trim()
    if ck isnt ""
      parsed = ck.split("=")[0]
      cookies.push parsed.toLowerCase().trim()  if parsed and parsed isnt ""
    return

  cookies = filterByWhitelist(cookies, globalOptions.cookieWhitelist)
  cookies.sort()

applyMatchingFilters = (reqUrl, reqBody) ->
  filteredUrl = reqUrl
  filteredBody = reqBody
  globalOptions.filenameFilters.forEach (filter) ->
    if filter.url.test(reqUrl)
      filteredUrl = filter.urlFilter(filteredUrl)
      filteredBody = filter.bodyFilter(filteredBody)
    return

  filteredUrl: filteredUrl
  filteredBody: filteredBody


gatherFilenameHashParts = (method, reqUrl, reqBody, reqHeaders) ->
  method = (method or "get").toLowerCase()
  reqHeaders = reqHeaders or {}
  filtered = applyMatchingFilters(reqUrl, reqBody)
  headerNames = []
  headerNames = parseHeaderNames(reqHeaders)  if globalOptions.includeHeaderNames
  cookieNames = []
  cookieNames = parseCookiesNames(reqHeaders.cookie)  if globalOptions.includeCookieNames

  # While an object would be the most natural way of gathering this
  # information, we shouldn't rely on JSON.stringify to serialize the keys of
  # an object in any specific order. Thus, we must be careful to use only an
  # ordered data structure, i.e. an array.
  [
    ["method",      method]
    ["url",         filtered.filteredUrl]
    ["body",        filtered.filteredBody]
    ["headerNames", headerNames]
    ["cookieNames", cookieNames]
  ]

usesGlobalFixtures = (reqUrl) ->
  globalOptions.filenameFilters.some (filter) ->
    filter.global and filter.url.test(reqUrl)

constructAndCreateFixtureFolder = (reqUrl, reqHeaders) ->
  reqHeaders = reqHeaders or {}
  language = reqHeaders["accept-language"] or ""
  language = language.split(",")[0]
  testFolder = ""
  unless usesGlobalFixtures(reqUrl)
    if reqHeaders["x-sepia-test-name"]
      testFolder = reqHeaders["x-sepia-test-name"]
    else testFolder = globalOptions.testOptions.testName  if globalOptions.testOptions.testName
  # folder = path.resolve(globalOptions.filenamePrefix, language, testFolder)
  folder = "#{globalOptions.rootPrefix}#{globalOptions.filenamePrefix}/#{language}/#{testFolder}"
  # mkdirpSync folder
  folder

constructFilename = (method, reqUrl, reqBody, reqHeaders) ->
  hashParts = gatherFilenameHashParts(method, reqUrl, reqBody, reqHeaders)
  # hash = crypto.createHash("md5")
  # hash.update JSON.stringify(hashParts)
  # filename = hash.digest("hex")
  filename = CryptoJS.MD5(JSON.stringify(hashParts)).toString()

  # console.log('HASHPARTS:', JSON.stringify(hashParts) + '    ->    ' + filename)

  folder = constructAndCreateFixtureFolder(reqUrl, reqHeaders)
  # hashFile = path.join(folder, filename).toString()
  # TODO: Include the folder
  hashFile = "#{folder}/#{filename}"


  # logFixtureStatus hashFile, hashParts
  # touchOnHit hashFile
  hashFile











# # Expect /fixtures/generated///2acf5dc1710b14bbb6548716349537ba
# x = new SepiaXMLHttpRequest()
# x.open('get', 'https://api.github.com:443/zen')
# x.setRequestHeader("User-Agent", "octokit")
# x.setRequestHeader("Accept", "application/vnd.github.raw")
# x.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT")
# x.setRequestHeader("Authorization", "token dca7f85a5911df8e9b7aeb4c5be8f5f50806ac49")
# x.setRequestHeader("Host", "api.github.com")
# x.onreadystatechange = () ->
#   if 4 == x.readyState
#     console.log(x.response)

# x.send()
