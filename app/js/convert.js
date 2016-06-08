/**
 * Created by Vitaly on 14.03.2016.
 */
var remote = require('remote');
var dialog = remote.require('dialog');
var fs = require('fs');
var popup = document.getElementById('popup');

document.addEventListener('dragover',function(event){
    event.preventDefault();
    return false;
},false);

document.addEventListener('dragenter', function (event) {
    event.preventDefault();
    popup.classList.add('dragged-over');
});

document.addEventListener('drop',function(event){
    event.preventDefault();
    popup.classList.remove('dragged-over');
    var filePath = event.dataTransfer.files[0].path;
    if (/\.(lib|scs)$/.test(filePath)) parseFile(filePath);
    else dialog.showErrorBox('Error', 'Incorrect file extension!');
    return false;
},false);

document.addEventListener('dragleave', function (event) {
    event.preventDefault();
    popup.classList.remove('dragged-over');
});

String.prototype.allReplace = function(obj) {
    var retStr = this;
    for (var x in obj) {
        retStr = retStr.replace(new RegExp(x, 'g'), obj[x]);
    }
    return retStr;
};

function parseFile(fileName) {
    fs.readFile(fileName, 'utf-8', function(err, data) {
        //////////////// LIB TO SCS PARSING ///////////////////
            if (/\.lib$/.test(fileName)) {
            data = data.replace(/\(([\s\S]*?)\)/g, function (str) {return str.toLowerCase();});
            data = data.replace(/^\*/gm, '//');
            if(!(/simulator lang=spectre insensitive=yes/.test(data))) {
                data = data.allReplace({
                    '^': 'simulator lang=spectre insensitive=yes \n'
                })
            }
            if (/ibm013/.test(fileName)) {
                data = data.allReplace({
                    '\\(|\\)': '',
                    '\\.MODEL CMOSN.*': 'model n_18_mm bsim3v3 type=n',
                    '\\.MODEL CMOSP.*': 'model p_18_mm bsim3v3 type=p'
                })
            } else if (/diode/.test(fileName)){
                data = data.allReplace({
                    '\\.model': 'model'
                })
            } else if (/opa/.test(fileName)) {
                data = data.replace(/utput\n\/[\s\S]*/g, function (str) {return str.toLowerCase();});
                data = data.allReplace({
                    '(\\.)([\\D])': '$2',
                    '([0-9]+)(meg)': '$1M',
                    'poly\\(1\\)': 'pvccs',
                    'poly\\(2\\)': 'pvcvs',
                    '(subckt opa[0-9]+) ([\\S].+)': '$1( $2 )',
                    '(c_c[0-9]+)\\s+(\\S+ \\S+)\\s+((\\d|\\.)*)': '$1 ( $2 ) capacitor c=$3',
                    '(r_r[0-9]+)\\s+(\\S+ \\S+)\\s+((\\d|\\.)*)': '$1 ( $2 ) resistor r=$3',
                    '(l_l[0-9]+)\\s+(\\S+ \\S+)\\s+((\\d|\\.)*)': '$1 ( $2 ) inductor l=$3',
                    '((g|e)_(g|e)[0-9]+)\\s+(\\S+ \\S+) (pvccs|pvcvs) (\\S+ \\S+) (\\S+ \\S+ \\S+ \\S+)': '$1 ( $4  $6 ) $5 coeffs=[$7 ]',
                    '((v|i)_(v|i)[0-9]+)\\s+(\\S+ \\S+) dc (\\S+)': '$1 ( $4 ) $2source dc=$5',
                    '(d_d[0-9]+)\\s+(\\S+ \\S+) dx (\\S+)': '$1 ( $2 ) dx area=$3',
                    '((q|j)_(q|j)[0-9]+)\\s+(\\S+ \\S+ \\S+) (\\S+) (\\S+)': '$1 ( $4 ) $5 area=$6',
                    '(e_e5[0-9])\\s+(\\S+ \\S+) (pvccs|pvcvs) (\\S+ \\S+)  (\\S+ \\S+) (\\S+ \\S+ \\S+)': '$1 ( $2  $4 $5 ) $3 coeffs=[$6 ]',
                    '(model \\S+) d\\((.*)\\)': '$1 diode \n+ $2',
                    '(model (npn|pnp)[0-9]) (npn|pnp)': '$1 bjt type=$3',
                    '(model \\S+) (n|p)jf\\(([\\s\\S]*)\\)': '$1 jfet type=$2\n+ $3',
                    '(\\d)nh': '$1n'
                })
            }
            else {
                data = data.allReplace({
                    '\\(|\\)': '',
                    '(\\.MODEL CMOSN.*)|(\\.model cmosn.*)': 'model cmosn bsim3v3 type=n',
                    '(\\.MODEL CMOSP.*)|(\\.model cmosp.*)': 'model cmosp bsim3v3 type=p'
                })
            }
                saveSCS(data);
        }
        //////////////// SCS TO LIB PARSING ///////////////////
         else if (/\.scs$/.test(fileName)) {
                data = data.replace(/^\/\//gm, '*');
                if (/ibm013/.test(fileName)) {
                    data = data.replace(/^simulator lang=spectre.*$/gm, '');
                    data = data.allReplace({
                        'model n_18_mm bsim3v3 type=n': '.MODEL CMOSN NMOS (     LEVEL   = 49',
                        'model p_18_mm bsim3v3 type=p': '.MODEL CMOSP NMOS (     LEVEL   = 49',
                        '(\\+.*)(\\s*\\*)': '$1 )$2'
                    });
                    data = data.replace(/\(([\s\S]*?)\)/g, function (str) {return str.toUpperCase();});
                } else if (/diode/.test(fileName)) {
                    data = data.allReplace({
                        'model': '.model'
                    })
                } else if (/opa/.test(fileName)) {
                    data = data.replace(/utput\n\/[\s\S]*/g, function (str) {return str.toUpperCase();});
                }
         saveLIB(data);
        }
    });
}

function openFile() {
    dialog.showOpenDialog({ filters: [
            {name: 'All models', extensions: ['lib', 'scs']},
            {name: 'LIB model', extensions: ['lib']},
            {name: 'SCS model', extensions: ['scs']}
        ]},
        function (files){
            if (files === undefined) return;
            var filePath = files[0];
            parseFile(filePath);
        });
}

function saveFile(fileName, data) {
    console.log(fileName);
    if (fileName === undefined) return;
    fs.writeFile(fileName, data, function (err) {
        if (err == undefined) {
            dialog.showMessageBox({ message: "The file has been saved!",
                buttons: ["OK"] });
        } else {
            dialog.showErrorBox("File Save Error", err.message);
        }
    });
}
function saveSCS(data) {
    dialog.showSaveDialog({ filters: [
        {name: 'SCS model', extensions: ['scs']}
    ], title: 'SCS FILE save', defaultPath: 'newModel'}, function (fileName) {
        saveFile(fileName, data);
    });
}
function saveLIB(data) {
    dialog.showSaveDialog({ filters: [
        {name: 'LIB model', extensions: ['lib']}
    ], title: 'LIB FILE save', defaultPath: 'newModel'}, function (fileName) {
        saveFile(fileName, data);
    });
}


