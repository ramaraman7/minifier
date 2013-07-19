var fs = require('fs')
var path = require('path')
var format = require('util').format
var sqwish = require('sqwish')
var uglify = require('uglify-js')
var stripUTF8ByteOrder = require('./utils').stripUTF8ByteOrder
var generateOutput = require('./utils').generateOutputName
var glob = require('glob-whatev')
var cssParser = require('./css')

var EventEmitter = require('events').EventEmitter
var obj = new EventEmitter()

obj.minify = minify
obj.generateOutput = generateOutput

module.exports = obj

function minify(input, options) {
	var output
	var template

	if(!input) {
		obj.emit('error', new Error('The input is required'))
	}

	output = options.output
	template = options.template

	if(output && template) {
		obj.emit(
			  'error'
			,   new Error('It does not make sense to provide both --output and '
			  + '--template options. Please choose one.')
		)
	}

	if(fs.statSync(input).isDirectory()) {
		if(options.clean) {
			clean(input, template || '{{filename}}.min.{{ext}}')
		}

		glob.glob(path.join(input, '**/*.js')).every(handleInput)
		glob.glob(path.join(input, '**/*.css')).every(handleInput)

		return
	}

	handleInput(input)

	function handleInput(input) {
		if(!/\.(js|css)$/.test(input)) {
			obj.on(
				  'error'
				, new Error(format(
				    'Please reference a file with the extension .js or .css. You referenced <%s>'
				  , input
				  ))
				)
			return false
		}

		if(/\.js$/.test(input)) {
			js(input)
		} else {
			css(input)
		}
		return true
	}

	function js(input) {
		var min = uglify.minify(input).code
		var renderedOutput = generateOutput(input, min, output || template)

		fs.writeFileSync(renderedOutput, min)
	}

	function css(input) {
		var inDir = path.dirname(input)
		var outDir = path.dirname(output || input)
		var root = path.join(inDir, path.relative(inDir, outDir))
		var max = cssParser.parse(input, root)
		var max = stripUTF8ByteOrder(max)
		var min = sqwish.minify(max, false)
		var renderedOutput = generateOutput(input, min, output || template)

		fs.writeFileSync(renderedOutput, min)
	}

	function clean(dir, template) {
		template = template.replace(/{{[^}]*}}/g, '*')
		glob.glob(path.join(dir, '**/', template)).forEach(function(file) {
			fs.unlink(file)
		})
	}
}
