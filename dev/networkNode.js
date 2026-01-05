const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const { v1: uuidv1 } = require('uuid');
const rp = require('request-promise');
const cors = require('cors');

const port = process.argv[2];
const nodeAddress = uuidv1().split('-').join('');

const ecoToken = new Blockchain();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --- API Endpoints ---

app.get('/blockchain', function(req, res) {
    res.send(ecoToken);
});

app.post('/transaction', function(req, res) {
    const newTransaction = req.body;
    const blockIndex = ecoToken.addTransactionToPendingTransactions(newTransaction);
    res.json({ note: `Transaction will be added in block ${blockIndex}.` });
});

app.post('/transaction/broadcast', function(req, res) {
    const newTransaction = ecoToken.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    ecoToken.addTransactionToPendingTransactions(newTransaction);

    const requestPromises = [];
    ecoToken.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };
        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(data => {
            res.json({ note: 'Transaction created and broadcast successfully.' });
        });
});

app.get('/mine', function(req, res) {
    const lastBlock = ecoToken.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: ecoToken.pendingTransactions,
        index: lastBlock['index'] + 1
    };
    
    const nonce = ecoToken.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = ecoToken.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = ecoToken.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = [];
    ecoToken.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };
        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(data => {
            // BAGIAN REWARD SYSTEM (12.5 ECO) SUDAHDIHAPUS DARI SINI
            // Sistem sekarang hanya akan melakukan mining transaksi user saja.
            
            res.json({
                note: "New block mined successfully",
                block: newBlock
            });
        });
});

app.post('/receive-new-block', function(req, res) {
    const newBlock = req.body.newBlock;
    const lastBlock = ecoToken.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        ecoToken.chain.push(newBlock);
        ecoToken.pendingTransactions = [];
        res.json({
            note: "New block received and accepted.",
            newBlock: newBlock
        });
    } else {
        res.json({
            note: 'New block rejected.',
            newBlock: newBlock
        });
    }
});

// --- Decentralization / Network Nodes ---

app.post('/register-and-broadcast-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if (ecoToken.networkNodes.indexOf(newNodeUrl) == -1) ecoToken.networkNodes.push(newNodeUrl);

    const regNodesPromises = [];
    ecoToken.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: { newNodeUrl: newNodeUrl },
            json: true
        };
        regNodesPromises.push(rp(requestOptions));
    });

    Promise.all(regNodesPromises)
        .then(data => {
            const bulkRegisterOptions = {
                uri: newNodeUrl + '/register-nodes-bulk',
                method: 'POST',
                body: { allNetworkNodes: [...ecoToken.networkNodes, ecoToken.currentNodeUrl] },
                json: true
            };
            return rp(bulkRegisterOptions);
        })
        .then(data => {
            res.json({ note: 'New node registered with network successfully.' });
        });
});

app.post('/register-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = ecoToken.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = ecoToken.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) ecoToken.networkNodes.push(newNodeUrl);
    res.json({ note: 'New node registered successfully.' });
});

app.post('/register-nodes-bulk', function(req, res) {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = ecoToken.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = ecoToken.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) ecoToken.networkNodes.push(networkNodeUrl);
    });
    res.json({ note: 'Bulk registration successful.' });
});

app.get('/consensus', function(req, res) {
    const requestPromises = [];
    ecoToken.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/blockchain',
            method: 'GET',
            json: true
        };
        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(blockchains => {
            const currentChainLength = ecoToken.chain.length;
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;

            blockchains.forEach(blockchain => {
                if (blockchain.chain.length > maxChainLength) {
                    maxChainLength = blockchain.chain.length;
                    newLongestChain = blockchain.chain;
                    newPendingTransactions = blockchain.pendingTransactions;
                };
            });

            if (!newLongestChain || (newLongestChain && !ecoToken.chainIsValid(newLongestChain))) {
                res.json({
                    note: 'Current chain has not been replaced.',
                    chain: ecoToken.chain
                });
            } else if (newLongestChain && ecoToken.chainIsValid(newLongestChain)) {
                ecoToken.chain = newLongestChain;
                ecoToken.pendingTransactions = newPendingTransactions;
                res.json({
                    note: 'This chain has been replaced.',
                    chain: ecoToken.chain
                });
            }
        });
});

app.get('/', function(req, res) {
    res.send("EcoToken Node is Running");
});

app.listen(port, function() {
    console.log(`EcoToken Node listening on port ${port}...`);
});