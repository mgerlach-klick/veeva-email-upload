
let validate = require('validate-fields')();
const assert = require('assert');
const fs = require('fs');
const vault = require("veeva-vault");

///////////////////////////////////
// Data Structure for Validation //
///////////////////////////////////

let BooleanString =  "in(true, false)";

var EmailTemplate = {
    version: "in(2019-04-01)",
    filepath: String,
    file: Object, // fs.ReaddStream from filepath
    "name__v": String,
    "lifecycle__v": "in(Approved Email)",
    "type__v": "in(Email Template)",
    "document_id?": String,
    "product__v": String,
    "country__v": String,
    "restrict_fragments_by_product__v?": BooleanString,
    "from_name__v": String,
    "from_address__v": String,
    "reply_to_name__v": String,
    "reply_to_address__v": String,
    "subject__v": String
}

var EmailFragment = {
    filepath: String,
    file: Object, // fs.ReaddStream from filepath
    "name__v": String,
    "lifecycle__v": "in(Approved Email)",
    "type__v": "in(Email Fragment)",
    "document_id?": String,
    "product__v": String,
    "country__v": String
}

var assertValid = (schema, value) => {
    if(! validate(schema, value)){
        console.error(validate.lastError);
        console.log(value)
        throw Error(validate.lastError)}}

/////////////////////////
// Data normalization  //
/////////////////////////

var normalizeEmailTemplate = function (origEmailTemplateData) {
    var emailTemplateData = Object.assign({}, origEmailTemplateData); // make a copy

    emailTemplateData["document_id"] =  emailTemplateData["document_id"] || null;
    emailTemplateData["lifecycle__v"] =  emailTemplateData["lifecycle__v"] || "Approved Email";
    emailTemplateData["type__v"] =  emailTemplateData["type__v"] || "Email Template";

    emailTemplateData["file"] = fs.createReadStream(emailTemplateData["filepath"])

    assertValid(EmailTemplate, emailTemplateData);
    return emailTemplateData;
}

var normalizeEmailFragment = function(emailTemplateData, origFragmentData) {
    var fragmentData = Object.assign({}, origFragmentData); // make a copy

    fragmentData["document_id"] = fragmentData["document_id"] || null;
    fragmentData["lifecycle__v"] =  fragmentData["lifecycle__v"] || "Approved Email";
    fragmentData["type__v"] =  fragmentData["type__v"] || "Email Template";
    fragmentData["product__v"] = fragmentData["product__v"] || emailTemplateData["product__v"];
    fragmentData["country__v"] = fragmentData["country__v"] || emailTemplateData["country__v"];
    fragmentData["file"] = fs.createReadStream(fragmentData["filepath"])

    assertValid(EmailFragment, fragmentData);
    return fragmentData;
}

var normalizeData = function(data) {
    var emailData = normalizeEmailTemplate(data);
    emailData["relations"] = data["relations"].map(fragment => normalizeEmailFragment(emailData, fragment))
    return emailData;
}

////////////////////////
// Creation functions //
////////////////////////


var createEmailTemplate = function (emailTemplate) {
    delete emailTemplate.relations;
    // delete emailTemplate.document_id;
    // console.log(emailTemplate)
    var creationPromise = vault.createDocument(emailTemplate);
    return creationPromise;
}

//////////
// Main //
//////////

var secret = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
var emailData = JSON.parse(fs.readFileSync("veeva.json", "utf8"));

var normalizedEmailData = normalizeData(emailData)
// console.log(normalizedEmailData)

// upload stuf!!!
// vault.verbose(true);

vault.authenticate(secret)
    .then(function() {
        return createEmailTemplate(normalizedEmailData)
    }).then( ret => { console.log(ret); return ret})
    .catch(function(e) {
        console.log("Error using Vault API:", e.message);
    });
