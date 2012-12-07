// Important: You must install `temporary`: `npm install`
/*
 * grunt
 * https://github.com/cowboy/grunt
 *
 * Copyright (c) 2012 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 *
 * JSCoverage task
 * Copyright (c) 2012 David Wilhelm
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 */

module.exports = function(grunt) {
  "use strict";

  // Grunt utilities.
  var task = grunt.task,

      file = grunt.file,
      utils = grunt.utils,
      log = grunt.log,
      verbose = grunt.verbose,
      fail = grunt.fail,
      option = grunt.option,
      config = grunt.config,
      template = grunt.template,
      fs = require('fs'),
      path = require('path'),

  // External libs.
  Tempfile = require('temporary/lib/file');

  // Allow an error message to retain its color when split across multiple lines.
  function formatMessage(str) {
    return String(str).split('\n').map(function(s) { return s.magenta; }).join('\n');
  }

  // Handle methods passed from PhantomJS, including Mocha hooks.
  var phantomHandlers = {
    done: function(failed, passed, total, duration) {
      //var nDuration = parseFloat(duration) || 0;
      //status.duration += Math.round(nDuration*100)/100;
      //Print assertion errors here, if verbose mode is disabled.
      if (!option('verbose')) {
          log.ok();
      }
    },
    //Error handlers.
    done_fail: function(url) {
      verbose.write('Running PhantomJS...').or.write('...');
      log.error();
      grunt.warn('PhantomJS unable to load "' + url + '" URI.', 90);
    },
    done_timeout: function() {
      log.writeln();
      grunt.warn('PhantomJS timed out', 90);
    },
    
    //console.log pass-through.
    console: console.log.bind(console),
    //Debugging messages.
    debug: log.debug.bind(log, 'phantomjs')
  };

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('jscoverage', 'Run jscoverage in a headless PhantomJS instance.', function() {
    
    // Get files as URLs.
    var jscoverage_server = this.data.jscoverage_server,
         paths = this.data.paths,
         done = this.async(),
         tempfile, id, n;

    grunt.utils.async.forEachSeries(paths, function(path, next) {

      grunt.verbose.subhead('Testing ' + path).or.write('Testing ' + path);

      // Create temporary file to be used for grunt-phantom communication.
      var tempfile = new Tempfile();
      // Timeout ID.
      var id;
      // The number of tempfile lines already read.
      var n = 0;

      // Clean up.
      function cleanup() {
        clearTimeout(id);
        tempfile.unlink();
      }

      (function loopy() {
          // Disable logging temporarily.
          grunt.log.muted = true;
          // Read the file, splitting lines on \n, and removing a trailing line.
          var lines = grunt.file.read(tempfile.path).split('\n').slice(0, -1);
          // Re-enable logging.
          grunt.log.muted = false;
          // Iterate over all lines that haven't already been processed.
          var done = lines.slice(n).some(function(line) {
              // Get args and method.
              var args = JSON.parse(line);
              var method = args.shift();
              // Execute method if it exists.
              if (phantomHandlers[method]) {
                  phantomHandlers[method].apply(null, args);
              }
              // If the method name started with test, return true. Because the
              // Array#some method was used, this not only sets "done" to true,
              // but stops further iteration from occurring.
              return (/^done/).test(method);
          });

          if (done) {
              // All done.
              cleanup();
              next();
          } else {
              // Update n so previously processed lines are ignored.
              n = lines.length;
              // Check back in a little bit.
              id = setTimeout(loopy, 100);
          }
      }());

      // Launch PhantomJS.
      grunt.helper('phantomjs', {
        code: 90,
        args: [
          '--config=' + grunt.task.getFile('jscoverage/phantom.json'),
          // The main script file.
          task.getFile('jscoverage/get_coverage.js'),
          // The temporary file used for communications.
          tempfile.path,
          // The Mocha helper file to be injected.
          // task.getFile('../test/run-mocha.js'),
          // URL to the Mocha .html test file to run.
          jscoverage_server,
          path
          // Additional configuration
          // PhantomJS options.
          //'--config=' + task.getFile('mocha/phantom.json')
        ],
        done: function(err) {
          if (err) {
            grunt.warn("encountered error", err);
            cleanup();
            done();
          }
        }
      });
      
    }, function(err) {
      // Log results.
        verbose.writeln();
        //grunt.warn("complete:", status.failed);
      // All done!
      done();
    });
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  grunt.registerHelper('phantomjs', function(options) {
    return utils.spawn({
      cmd: 'phantomjs',
      args: options.args
    }, function(err, result, code) {
      if (!err) { return options.done(null); }
      // Something went horribly wrong.
      verbose.or.writeln();
      log.write('Running PhantomJS...').error();
      if (code === 127) {
        log.errorlns(
          'In order for this task to work properly, PhantomJS must be ' +
          'installed and in the system PATH (if you can run "phantomjs" at' +
          ' the command line, this task should work). Unfortunately, ' +
          'PhantomJS cannot be installed automatically via npm or grunt. ' +
          'See the grunt FAQ for PhantomJS installation instructions: ' +
          'https://github.com/cowboy/grunt/blob/master/docs/faq.md'
        );
        grunt.warn('PhantomJS not found.', options.code);
      } else {
        result.split('\n').forEach(log.error, log);
        grunt.warn('PhantomJS exited unexpectedly with exit code ' + code + '.', options.code);
      }
      options.done(code);
    });
  });

};
