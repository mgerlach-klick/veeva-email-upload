var secret = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
var emailData = JSON.parse(fs.readFileSync("veeva.json", "utf8"));
let validate = require('validate-fields');
const assert = require('assert');

///////////////////////////////////
// Data Structure for Validation //
///////////////////////////////////

var EmailTemplate = {
    file: String,
    "name__v": String,
    "lifecycle__v": "Approved Email",
    "type__v": "Email Template",
    "document_id?": String,
    "product__v": String,
    "country__v": String,
    "restrict_fragments_by_product__v": true,
    "from_name__v": String,
    "from_address__v": String,
    "reply_to_name__v": String,
    "reply_to_address__v": String,
    "template_subject__v": String
}

var EmailFragment = {
    file: String,
    "name__v": String,
    "lifecycle__v": "Approved Email",
    "type__v": "Email Fragment",
    "document_id?": String,
    "product__v": String,
    "country__v": String
}

/////////////////////////
// Data normalization  //
/////////////////////////

var normalizeEmailTemplate = function (origEmailTemplateData) {
    var emailTemplateData = Object.assign({}, origEmailTemplateData); // make a copy

    emailTemplateData["document_id"] =  emailTemplateData["document_id"] || null;
    emailTemplateData["lifecycle__v"] =  emailTemplateData["lifecycle__v"] || "Approved Email";
    emailTemplateData["type__v"] =  emailTemplateData["type__v"] || "Email Template";
    assert(validate(EmailTemplate, emailTemplateData));
    return emailTemplateData;
}

var normalizeEmailFragment = function(origFragmentData, emailTemplateData) {
    var fragmentData = Object.assign({}, origFragmentData); // make a copy

    fragmentData["document_id"] = fragmentData["document_id"] || null;
    fragmentData["lifecycle__v"] =  fragmentData["lifecycle__v"] || "Approved Email";
    fragmentData["type__v"] =  fragmentData["type__v"] || "Email Template";
    fragmentData["product__v"] = fragmentData["product__v"] || emailTemplateData["product__v"];
    fragmentData["country__v"] = fragmentData["country__v"] || emailTemplateData["country__v"];

    assert(validate(EmailFragment, fragmentData));
    return fragmentData;
}

var normalizeData = function(data) {

}
