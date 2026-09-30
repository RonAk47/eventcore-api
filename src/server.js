const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
    console.log(`EventCore API listening on port ${port}`);
});
