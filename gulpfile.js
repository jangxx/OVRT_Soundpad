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

const is_production = util.env.production;

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
            .pipe(gulpif(!is_production, sourcemaps.init({loadMaps: true})))
            .pipe(gulpif(is_production, uglify().on('error', console.log)))
            .pipe(gulpif(!is_production, sourcemaps.write()))
            .pipe(gulp.dest('./build/js'))
            .on("end", resolve)
            .on("error", reject);
	}))).catch(err => {
        console.error("Error while building JS:", err);
    });
});

gulp.task('styles', function() {
    return gulp.src(paths.styles)
        .pipe(gulpif(!is_production, sourcemaps.init()))
            .pipe(sass().on('error', sass.logError))
        .pipe(gulpif(!is_production, sourcemaps.write()))
        .pipe(gulpif(is_production, cleanCSS()))
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

    const assets_definition = await fs.readJSON("./workshop_assets.json");
    const assets = assets_definition.all;

    if (is_production) {
        Object.assign(assets, assets_definition.prod);
    } else {
        Object.assign(assets, assets_definition.dev);
    }

    for (let asset in assets) {
        let definition = assets[asset];
        // allows the use of a simple string to define the destination instead of writing a whole object
        if (typeof definition !== "object") {
            definition = { to: definition };
        }
        // the "to" key is optional, if it's missing the top level is implied
        if (definition.to === undefined) {
            definition.to = "";
        }

        const dest = path.join(paths.deploy_output, definition.to);

        // make sure destination exists
        await fs.mkdirp(dest);

        const files = glob.sync(asset);
        for (let file of files) {
            const stat = fs.lstatSync(file);

            if (stat.isDirectory()) {
                await fs.copy(file, dest);
            } else if (stat.isFile()) {
                let filename = path.basename(file);
                if (definition.rename !== undefined) {
                    filename = definition.rename;
                }
                await fs.copy(file, path.join(dest, filename));
            }
        }
    }
});

gulp.task('build', gulp.series([ 'clean', 'scripts', 'styles', "deploy" ]));
gulp.task('default', gulp.series([ "build", "watch", "serve" ]));