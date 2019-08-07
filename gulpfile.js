const gulp = require('gulp')
const browserSync = require('browser-sync').create()
const reload = browserSync.reload
const stylus = require('gulp-stylus')
const minifyCss = require('gulp-minify-css')

const src = {
    css: './src/stylus/*.styl'
}

gulp.task('watch', () => {
    browserSync.init({
        server: './'
    })
    
    gulp.watch([
        '*.html'
    ]).on('change', reload)

    gulp.watch(src.css, gulp.series('stylus'))
})

gulp.task('stylus', () => {
    return gulp.src(src.css)
                .pipe(stylus())
                .pipe(minifyCss())
                .pipe(gulp.dest('./dist/css'))
                .pipe(reload({stream: true}))
})


gulp.task('default',
    gulp.series(gulp.parallel('stylus'), 'watch')
);
