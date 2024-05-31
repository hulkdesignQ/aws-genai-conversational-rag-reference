// ~~ Generated by projen. To modify, edit .projenrc.js and run "npx projen".

$version: "2"

metadata validators = [
    
    {
      id: "SupportedLanguage_handler"
      name: "EmitEachSelector"
      configuration: {
          bindToTrait: com.amazon#handler
          selector: """
              :not([@trait|com.amazon#handler: @{language} = typescript, java, python])
          """
          messageTemplate: """
              @{trait|com.amazon#handler|language} is not supported by type-safe-api.
              Supported languages are "typescript", "java" and "python".
          """
      }
    }
    
    {
      id: "ConfiguredHandlerProject_handler"
      name: "EmitEachSelector"
      configuration: {
          bindToTrait: com.amazon#handler
          selector: """
              [@trait|com.amazon#handler: @{language} = typescript, java, python]
              :not([@trait|com.amazon#handler: @{language} = typescript])
          """
          messageTemplate: """
              @@handler language @{trait|com.amazon#handler|language} cannot be referenced unless a handler project is configured for this language.
              Configured handler project languages are: typescript.
              You can add this language by configuring TypeSafeApiProject in your .projenrc
          """
      }
    }
]

namespace com.amazon

/// Add this trait to an operation to generate a lambda handler stub for the operation.
/// You have configured handler projects for typescript
@trait(selector: "operation")
structure handler {
    /// The language you will implement the lambda in.
    /// Valid values: typescript, java, python
    @required
    language: String
}
