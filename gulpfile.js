// require('dotenv').config();

const gulp = require('gulp');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const gulpif = require('gulp-if');
const util = require('gulp-util');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify-es').default;
const envify = require('envify/custom');
const cleanCSS = require('gulp-clean-css');
const glob = require("glob");
const del = require('del');
const express = require('express');
const fs = require('fs-extra');

const path = require('path');

const paths = {
    styles: 'src/scss/*.scss',
    scripts_entry: 'main.js',
    scripts_base: 'src/js/*',
    scripts: [ "*.js" ],
    ovrt: "src/ovrt/",
    html_base: "src/html/",
    html: "*.html",
    deploy_output: "dist/workshop",
};

const listen_port = (process.env.GULP_PORT !== undefined) ? process.env.PORT : 8080;
const listen_addr = (process.env.GULP_ADDR !== undefined) ? process.env.ADDR : "localhost";

const use_sourcemaps = !util.env.production;
const use_uglify = util.env.production;

gulp.task('clean', function() {
    return del([ 'build' ]);
});

gulp.task('serve', function() {
	return new Promise(resolve => {
		const app = express();

		app.use("/", express.static(path.join(__dirname, paths.deploy_output, "html")));

		app.listen(listen_port, listen_addr, () => {
			console.log(`Server is listening on port ${listen_addr}:${listen_port}`);
			resolve();
		});
	});	
});

gulp.task('scripts', function() {
	const files = glob.sync(paths.scripts_base);

	return Promise.all(files.map(filepath => new Promise((resolve, reject) => { 
        if (!fs.existsSync(path.join(filepath, paths.scripts_entry))) return resolve();

		return browserify(path.join(filepath, paths.scripts_entry), {debug: true, extensions: ['es6']})
            .transform(envify({
                NODE_ENV: (util.env.production) ? 'production' : undefined,
                ENV: (util.env.production) ? 'production' : 'development',
            }), {global: true})
            .bundle()
            .pipe(source(path.basename(filepath) + '.js'))
            .pipe(buffer())
            .pipe(gulpif(use_sourcemaps, sourcemaps.init({loadMaps: true})))
            .pipe(gulpif(use_uglify, uglify().on('error', console.log)))
            .pipe(gulpif(use_sourcemaps, sourcemaps.write()))
            .pipe(gulp.dest('./build/js'))
            .on("end", resolve)
            .on("error", reject);
	}))).catch(err => {
        console.error("Error while building JS:", err);
    });
});

gulp.task('styles', function() {
    return gulp.src(paths.styles)
        .pipe(gulpif(use_sourcemaps, sourcemaps.init()))
            .pipe(sass().on('error', sass.logError))
        .pipe(gulpif(use_sourcemaps, sourcemaps.write()))
        .pipe(gulpif(use_uglify, cleanCSS()))
        .pipe(gulp.dest('./build/css'));
});

gulp.task('watch', function() {
	const jsFiles = glob.sync(paths.scripts_base);

    for (let jsf of jsFiles) {
		for (let s of paths.scripts) {
			gulp.watch(path.join(jsf, s).replace(/\\/g, '/'), gulp.series([ 'scripts', "deploy" ]));
		}
    }

    gulp.watch(paths.styles, gulp.series([ 'styles', "deploy" ]));
    gulp.watch(path.join(paths.html_base, paths.html).replace(/\\/g, '/'), gulp.series([ "deploy" ]));

    return Promise.resolve();
});

gulp.task("deploy", async function() {
    await del(path.join(paths.deploy_output));
    await fs.mkdirp(paths.deploy_output);
    await fs.mkdir(path.join(paths.deploy_output, "html"));
    await fs.mkdir(path.join(paths.deploy_output, "html/build"));
    await fs.mkdir(path.join(paths.deploy_output, "html/assets"));
    await fs.mkdir(path.join(paths.deploy_output, "html/assets/img"));

    await fs.copy(paths.ovrt, paths.deploy_output);
    await fs.copy(paths.html_base, path.join(paths.deploy_output, "html"));
    await fs.copy("assets/img", path.join(paths.deploy_output, "html/assets/img"));
    await fs.copy("build", path.join(paths.deploy_output, "html/build"));
});

gulp.task('build', gulp.series([ 'clean', 'scripts', 'styles', "deploy" ]));
gulp.task('default', gulp.series([ "build", "watch", "serve" ]));