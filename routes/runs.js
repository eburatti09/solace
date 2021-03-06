var fs = require('fs'),
    cfg = require('../config.js');

exports.get = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        var run = result.rows[0];

        req.db.query("SELECT f.id, f.exp_id, f.name, f.type, f.size, f.created_at \
                        FROM experiment_files f, run_files rf \
                        WHERE rf.instance_id = $1 \
                          AND rf.run_id = $2 \
                          AND rf.file_id = f.id \
                          AND f.name NOT LIKE '%.png' \
                        ORDER BY f.name ASC;",
                    [instId,runId], function(result) {

            run.files = result.rows;

            req.db.query('SELECT r.name, r.type \
                            FROM experiments e, experiment_result_variables r \
                            WHERE e.name = $1 AND r.exp_id = e.id;',
                        [expName], function(result) {

                req.db.done();
                run.results = result.rows;
                res.json(run);
            });
        });
    });
};

exports.update = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    var progress = parseFloat(req.body.progress),
        results = JSON.parse(req.body.results);

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        var run = result.rows[0];

        req.db.transaction(function (commit, rollback) {
            req.db.query('UPDATE runs SET progress = $3 WHERE id = $1 AND instance_id = $2;',
                        [runId, instId, progress], function(result) {

                req.db.query('SELECT MAX(moment) + 1 AS moment FROM run_result_values WHERE run_id = $1 AND instance_id = $2;',
                        [runId, instId], function(result) {

                    var moment = result.rows[0].moment || 0;

                    req.db.query("INSERT INTO run_result_values (run_id, instance_id, moment, name, value, type) \
                                    VALUES ($1, $2, $3, '_timestamp', EXTRACT(EPOCH FROM now())::integer::text, 'timestamp');",
                        [runId, instId, moment], function(result) {

                        var stream = req.db.copyFrom("COPY run_result_values \
                                                        (run_id, instance_id, moment, name, value, type) \
                                                        FROM STDIN WITH CSV;", function () {

                            commit(function () {
                                req.db.done();
                                res.json(200);
                            });
                        });

                        for (var i=0; i<results.length; i++) {
                            var name = results[i]['name'],
                                value = results[i]['value'],
                                type = results[i]['type'];

                            stream.write(runId+',"'+instId+'",'+moment+',"'+name+'","'+value+'",'+type+'\n');
                        }
                        stream.end();
                    });
                });
            });
        });
    });
};

exports.begin = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        req.db.query('UPDATE runs SET progress = 0, canceled = false, started_at = now() \
                        WHERE id = $1 AND instance_id = $2;',
                    [runId, instId], function(result) {

            req.db.done();
            res.json(200);
        });
    });
};

exports.done = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    var results = JSON.parse(req.body.results);

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        var run = result.rows[0];

        req.db.transaction(function (commit, rollback) {
            req.db.query('UPDATE runs SET progress = 1, finished_at = now() \
                            WHERE id = $1 AND instance_id = $2;',
                        [runId, instId], function(result) {

                req.db.query('SELECT MAX(moment) + 1 AS moment FROM run_result_values WHERE run_id = $1 AND instance_id = $2;',
                        [runId, instId], function(result) {

                    var moment = result.rows[0].moment || 0;

                    req.db.query("INSERT INTO run_result_values (run_id, instance_id, moment, name, value, type) \
                                    VALUES ($1, $2, $3, '_timestamp', EXTRACT(EPOCH FROM now())::integer::text, 'timestamp');",
                        [runId, instId, moment], function(result) {

                        var stream = req.db.copyFrom("COPY run_result_values \
                                                        (run_id, instance_id, moment, name, value, type) \
                                                        FROM STDIN WITH CSV;", function () {

                            commit(function () {
                                req.db.done();
                                res.json(200);
                            });
                        });

                        for (var i=0; i<results.length; i++) {
                            var name = results[i]['name'],
                                value = results[i]['value'],
                                type = results[i]['type'];

                            stream.write(runId+',"'+instId+'",'+moment+',"'+name+'","'+value+'",'+type+'\n');
                        }
                        stream.end();
                    });
                });
            });
        });
    });
};

exports.cancel = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        req.db.query('UPDATE runs SET canceled = true, finished_at = now() \
                        WHERE id = $1 AND instance_id = $2;',
                    [runId, instId], function(result) {

            req.db.done();
            res.json(200);
        });
    });
};

exports.upload = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    var file = req.files.file;

    if (!cfg.uploadPath)
        throw "Error! Upload path must be configured in config.js.";

    req.db.query('SELECT r.id, r.instance_id, r.started_at, r.finished_at, r.progress, r.canceled \
                    FROM experiments e, instances i, runs r \
                    WHERE e.name = $1 AND e.id = i.exp_id AND i.id = $2 AND r.id = $3;',
                [expName, instId, runId], function(result) {

        if (result.rows.length < 1) {
            req.db.done();
            return res.json(404, {error: 'not_found'});
        }

        var run = result.rows[0];

        req.db.transaction(function (commit, rollback) {
            req.db.query('INSERT INTO experiment_files (exp_id, name, type, size) \
                            (SELECT id,$2,$3,$4 FROM experiments WHERE name = $1) \
                            RETURNING id;',
                        [expName,
                         file.name || 'unnamed',
                         file.type || 'application/octet-stream',
                         file.size], function(result) {

                var fileId = result.rows[0].id;

                req.db.query('INSERT INTO run_files (run_id, instance_id, file_id) \
                                VALUES ($1, $2, $3);',
                            [runId, instId, fileId], function(result) {

                    var is = fs.createReadStream(file.path);
                    var os = fs.createWriteStream(cfg.uploadPath+'/'+fileId);

                    is.pipe(os);

                    is.on('error', function () {
                        fs.unlinkSync(file.path);

                        console.log(err);
                        res.json(500, {error: 'write_error'});
                    });

                    is.on('end',function() {
                        fs.unlinkSync(file.path);

                        commit(function () {
                            req.db.done();
                            res.json(200);
                        });
                    });
                });
            });
        });
    });
};

exports.listFiles = function(req, res) {
    var expName = req.params.expName,
        instId  = req.params.instId,
        runId   = parseInt(req.params.runId);

    req.db.query('SELECT f.id, f.exp_id, f.name, f.type, f.size, f.created_at \
                    FROM experiments e, instances i, runs r, experiment_files f, run_files rf \
                    WHERE e.name = $1 AND i.exp_id = e.id AND i.id = $2 \
                        AND rf.instance_id = i.id \
                        AND rf.run_id = $3 \
                        AND rf.file_id = f.id \
                    ORDER BY f.name ASC;',
                [expName,instId,runId], function(result) {

        req.db.done();
        res.json(result.rows);
    });
};