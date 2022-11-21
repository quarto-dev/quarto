
To try out a version of user comments that works as expected:


```bash
git clone git@github.com:rstudio/rstudio-internal.git
cd rstudio-internal 
git checkout feature/panmirror-next
cd src/gwt/panmirror 
nvm install 13.14.0
npm install -g yarn
yarn
yarn run start
```


To try out this branch (where user comments don't quite work):

```bash
git clone git@github.com:quarto-dev/quarto.git
cd quarto
git checkout feature/user-comments
nvm install v16.15.0
npm install -g yarn
yarn
yarn dev
```


