using UnrealBuildTool;
using System.Collections.Generic;

public class ExampleProjectEditorTarget : TargetRules
{
    public ExampleProjectEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        ExtraModuleNames.AddRange(new string[] { "ExampleProject" });
    }
}
