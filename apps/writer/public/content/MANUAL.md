---
title: Pandoc User's Guide
author: John MacFarlane
date: August 22, 2022
---

# Synopsis

`pandoc` [*options*] [*input-file*]...

# Description

Pandoc is a [Haskell] library for converting from one markup format to
another, and a command-line tool that uses this library.

Pandoc can convert between numerous markup and word processing formats,
including, but not limited to, various flavors of [Markdown], [HTML],
[LaTeX] and [Word docx]. For the full lists of input and output formats,
see the `--from` and `--to` [options below][General options].
Pandoc can also produce [PDF] output: see [creating a PDF], below.

Pandoc's enhanced version of Markdown includes syntax for [tables],
[definition lists], [metadata blocks], [footnotes], [citations], [math],
and much more.  See below under [Pandoc's Markdown].

Pandoc has a modular design: it consists of a set of readers, which parse
text in a given format and produce a native representation of the document
(an _abstract syntax tree_ or AST), and a set of writers, which convert
this native representation into a target format. Thus, adding an input
or output format requires only adding a reader or writer. Users can also
run custom [pandoc filters] to modify the intermediate AST.

Because pandoc's intermediate representation of a document is less
expressive than many of the formats it converts between, one should
not expect perfect conversions between every format and every other.
Pandoc attempts to preserve the structural elements of a document, but
not formatting details such as margin size.  And some document elements,
such as complex tables, may not fit into pandoc's simple document
model.  While conversions from pandoc's Markdown to all formats aspire
to be perfect, conversions from formats more expressive than pandoc's
Markdown can be expected to be lossy.

## Using pandoc

If no *input-files* are specified, input is read from *stdin*.
Output goes to *stdout* by default. For output to a file,
use the `-o` option:

    pandoc -o output.html input.txt

By default, pandoc produces a document fragment. To produce a standalone
document (e.g. a valid HTML file including `<head>` and `<body>`),
use the `-s` or `--standalone` flag:

    pandoc -s -o output.html input.txt

For more information on how standalone documents are produced, see
[Templates] below.

If multiple input files are given, pandoc will concatenate them all (with
blank lines between them) before parsing. (Use `--file-scope` to parse files
individually.)

## Specifying formats

The format of the input and output can be specified explicitly using
command-line options.  The input format can be specified using the
`-f/--from` option, the output format using the `-t/--to` option.
Thus, to convert `hello.txt` from Markdown to LaTeX, you could type:

    pandoc -f markdown -t latex hello.txt

To convert `hello.html` from HTML to Markdown:

    pandoc -f html -t markdown hello.html

Supported input and output formats are listed below under [Options]
(see `-f` for input formats and `-t` for output formats).  You
can also use `pandoc --list-input-formats` and
`pandoc --list-output-formats` to print lists of supported
formats.

If the input or output format is not specified explicitly, pandoc
will attempt to guess it from the extensions of the filenames.
Thus, for example,

    pandoc -o hello.tex hello.txt

will convert `hello.txt` from Markdown to LaTeX.  If no output file
is specified (so that output goes to *stdout*), or if the output file's
extension is unknown, the output format will default to HTML.
If no input file is specified (so that input comes from *stdin*), or
if the input files' extensions are unknown, the input format will
be assumed to be Markdown.

## Character encoding

Pandoc uses the UTF-8 character encoding for both input and output.
If your local character encoding is not UTF-8, you
should pipe input and output through [`iconv`]:

    iconv -t utf-8 input.txt | pandoc | iconv -f utf-8

Note that in some output formats (such as HTML, LaTeX, ConTeXt,
RTF, OPML, DocBook, and Texinfo), information about
the character encoding is included in the document header, which
will only be included if you use the `-s/--standalone` option.

[`iconv`]: https://www.gnu.org/software/libiconv/

## Creating a PDF

To produce a PDF, specify an output file with a `.pdf` extension:

    pandoc test.txt -o test.pdf

By default, pandoc will use LaTeX to create the PDF, which requires
that a LaTeX engine be installed (see `--pdf-engine` below).
Alternatively, pandoc can use ConTeXt, roff ms, or HTML as an
intermediate format.  To do this, specify an output file with a
`.pdf` extension, as before, but add the `--pdf-engine` option
or `-t context`, `-t html`, or `-t ms` to the command line.
The tool used to generate the PDF from the intermediate format
may be specified using `--pdf-engine`.

You can control the PDF style using variables, depending on
the intermediate format used: see [variables for LaTeX],
[variables for ConTeXt], [variables for `wkhtmltopdf`],
[variables for ms].  When HTML is used as an intermediate
format, the output can be styled using `--css`.

To debug the PDF creation, it can be useful to look at the intermediate
representation: instead of `-o test.pdf`, use for example `-s -o test.tex`
to output the generated LaTeX. You can then test it with `pdflatex test.tex`.

When using LaTeX, the following packages need to be available
(they are included with all recent versions of [TeX Live]):
[`amsfonts`], [`amsmath`], [`lm`], [`unicode-math`],
[`iftex`], [`listings`] (if the
`--listings` option is used), [`fancyvrb`], [`longtable`],
[`booktabs`], [`graphicx`] (if the document
contains images), [`hyperref`], [`xcolor`],
[`ulem`], [`geometry`] (with the `geometry` variable set),
[`setspace`] (with `linestretch`), and
[`babel`] (with `lang`).  If `CJKmainfont` is set, [`xeCJK`]
is needed.  The use of `xelatex` or `lualatex` as
the PDF engine requires [`fontspec`].  `lualatex` uses
[`selnolig`]. `xelatex` uses [`bidi`] (with the `dir` variable set).
If the `mathspec` variable is set, `xelatex` will use [`mathspec`]
instead of [`unicode-math`].  The [`upquote`] and [`microtype`]
packages are used if available, and [`csquotes`] will be used
for [typography] if the `csquotes` variable or metadata field is
set to a true value.  The [`natbib`], [`biblatex`], [`bibtex`],
and [`biber`] packages can optionally be used for [citation
rendering].  The following packages will be used to improve
output quality if present, but pandoc does not require them to
be present: [`upquote`] (for straight quotes in verbatim
environments), [`microtype`] (for better spacing adjustments),
[`parskip`] (for better inter-paragraph spaces), [`xurl`] (for
better line breaks in URLs), [`bookmark`] (for better PDF
bookmarks), and [`footnotehyper`] or [`footnote`] (to allow
footnotes in tables).

[TeX Live]: https://www.tug.org/texlive/
[`amsfonts`]: https://ctan.org/pkg/amsfonts
[`amsmath`]: https://ctan.org/pkg/amsmath
[`babel`]: https://ctan.org/pkg/babel
[`biber`]: https://ctan.org/pkg/biber
[`biblatex`]: https://ctan.org/pkg/biblatex
[`bibtex`]: https://ctan.org/pkg/bibtex
[`bidi`]: https://ctan.org/pkg/bidi
[`bookmark`]: https://ctan.org/pkg/bookmark
[`booktabs`]: https://ctan.org/pkg/booktabs
[`csquotes`]: https://ctan.org/pkg/csquotes
[`fancyvrb`]: https://ctan.org/pkg/fancyvrb
[`fontspec`]: https://ctan.org/pkg/fontspec
[`footnote`]: https://ctan.org/pkg/footnote
[`footnotehyper`]: https://ctan.org/pkg/footnotehyper
[`geometry`]: https://ctan.org/pkg/geometry
[`graphicx`]: https://ctan.org/pkg/graphicx
[`grffile`]: https://ctan.org/pkg/grffile
[`hyperref`]: https://ctan.org/pkg/hyperref
[`iftex`]: https://ctan.org/pkg/iftex
[`listings`]: https://ctan.org/pkg/listings
[`lm`]: https://ctan.org/pkg/lm
[`longtable`]: https://ctan.org/pkg/longtable
[`mathspec`]: https://ctan.org/pkg/mathspec
[`microtype`]: https://ctan.org/pkg/microtype
[`natbib`]: https://ctan.org/pkg/natbib
[`parskip`]: https://ctan.org/pkg/parskip
[`polyglossia`]: https://ctan.org/pkg/polyglossia
[`prince`]: https://www.princexml.com/
[`setspace`]: https://ctan.org/pkg/setspace
[`ulem`]: https://ctan.org/pkg/ulem
[`unicode-math`]: https://ctan.org/pkg/unicode-math
[`upquote`]: https://ctan.org/pkg/upquote
[`weasyprint`]: https://weasyprint.org
[`wkhtmltopdf`]: https://wkhtmltopdf.org
[`xcolor`]: https://ctan.org/pkg/xcolor
[`xeCJK`]: https://ctan.org/pkg/xecjk
[`xurl`]: https://ctan.org/pkg/xurl
[`selnolig`]: https://ctan.org/pkg/selnolig



## Reading from the Web

Instead of an input file, an absolute URI may be given. In this case
pandoc will fetch the content using HTTP:

    pandoc -f html -t markdown https://www.fsf.org

It is possible to supply a custom User-Agent string or other
header when requesting a document from a URL:

    pandoc -f html -t markdown --request-header User-Agent:"Mozilla/5.0" \
      https://www.fsf.org
