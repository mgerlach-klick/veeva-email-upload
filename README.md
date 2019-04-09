# What is this?
This is a tool that is supposed to make email upload to veeva faster and harder to mess up :)

Currently, email upload is a largely manual process that should really be a tool. This is the start of what could become such a tool.

This tool is using [Kendall's](https://genome.klick.com/user/index.html#/5480s) [Veeva Vault REST API Wrapper](https://github.com/KlickInc/klick-veeva-vault-wrapper). Indeed, the main contributions of this repository so far are:

- Create a skeleton project structure
- Create a configuration file starting point
- Test, and provide feedback to Kendall regarding his library

# What's in this repo?
- a sample email (without assets) consisting of a template and two fragments in the `email` folder
- a template that describes an email. All the keys are described at <https://developer.veevavault.com/docs/api/v13/>

# Design decisions
- Keys are taken directly from the veeva documentation because the minicule win in readability of, say, `fromName` to `from_name__v` isn't worth the trade-off of looking up the exact keys in the [api documentation](https://developer.veevavault.com/docs/api/v13/)
- a version key has been added to the data file to provide forward- and backward compatibility
- the [validate-fields](https://www.npmjs.com/package/validate-fields) has been chosen because to validate data because proper JSON schema is ridiculously complex for no good reason. Other than that, `validate-fields` was the first result on google that looked decent :)



# How to use
Currently, this project only uploads an email template. To get even this far, you need to create a (gitignored) `credentials.json` file in the repository that looks like this:

```js
{
    "host": "https://yourklickhost.veevavault.com/api/v13.0/",
    "username": "thelogin@email.com"
    "password": "correctbatteryhosestaplepassword"
}
```


# TODO
- Upload email fragments
- Link email fragments to template
- Upload email assets (images etc)
- Once uploaded, set the document ID and write the JSON file back to disk
- If the data file entries have a document ID, update those documents instead of creating new ones

# Project Owner
The lovely [Alexandra Nikitina](https://genome.klick.com/user/index.html#/5675)
