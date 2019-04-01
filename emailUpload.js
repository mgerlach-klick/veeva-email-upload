
let validate = require('validate-fields')();
const assert = require('assert');
const fs = require('fs');
const vault = require("veeva-vault");

///////////////////////////////////
// Data Structure for Validation //
///////////////////////////////////

var EmailTemplate = {
    version: "in(2019-04-01)",
    file: String,
    "name__v": String,
    "lifecycle__v": "in(Approved Email)",
    "type__v": "in(Email Template)",
    "document_id?": String,
    "product__v": String,
    "country__v": String,
    "restrict_fragments_by_product__v": Boolean,
    "from_name__v": String,
    "from_address__v": String,
    "reply_to_name__v": String,
    "reply_to_address__v": String,
    "template_subject__v": String
}

var EmailFragment = {
    file: String,
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

    assertValid(EmailFragment, fragmentData);
    return fragmentData;
}

var normalizeData = function(data) {
    var emailData = normalizeEmailTemplate(data);
    emailData["relations"] = data["relations"].map(fragment => normalizeEmailFragment(emailData, fragment))
    return emailData;
}

//////////
// Main //
//////////

var secret = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
var emailData = JSON.parse(fs.readFileSync("veeva.json", "utf8"));

var normalizedEmailData = normalizeData(emailData)


vault.authenticate(secret)
.then(function() {
    return vault.getProducts();
}).then(function(products) {
    console.log("Found these products:", products);
    return vault.getBinders();
}).catch(function(e) {
        console.log("Error using Vault API:", e.message);
});
