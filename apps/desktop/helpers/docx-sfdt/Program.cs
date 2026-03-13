using System.Text;
using System.Text.Json;
using Syncfusion.Licensing;

namespace OpenLoafDocxSfdt;

internal sealed class Program
{
    /// <summary>Serializer options for helper JSON I/O.</summary>
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Entry point for DOCX to SFDT conversion helper.</summary>
    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        if (args.Length == 0)
        {
            WriteError("缺少 action 参数。", "missing_action");
            return 1;
        }

        var action = args[0];
        var payloadJson = args.Length > 1 ? args[1] : "{}";

        try
        {
            return RunAction(action, payloadJson);
        }
        catch (Exception ex)
        {
            WriteError($"执行失败：{ex.Message}", "unexpected_error");
            return 1;
        }
    }

    /// <summary>Dispatch helper action to the matching handler.</summary>
    private static int RunAction(string action, string payloadJson)
    {
        return action switch
        {
            "convert" => HandleConvert(payloadJson),
            _ => HandleUnsupportedAction(action),
        };
    }

    /// <summary>Handle DOCX to SFDT conversion request.</summary>
    private static int HandleConvert(string payloadJson)
    {
        var payload = ReadPayload<ConvertPayload>(payloadJson);
        if (payload == null || string.IsNullOrWhiteSpace(payload.InputPath))
        {
            WriteError("缺少输入文件路径。", "invalid_input");
            return 0;
        }

        var inputPath = Path.GetFullPath(payload.InputPath.Trim());
        if (!File.Exists(inputPath))
        {
            WriteError("未找到 DOCX 文件。", "file_not_found");
            return 0;
        }

        if (!string.Equals(Path.GetExtension(inputPath), ".docx", StringComparison.OrdinalIgnoreCase))
        {
            WriteError("仅支持 .docx 文件。", "invalid_input");
            return 0;
        }

        var licenseKey = ResolveLicenseKey();
        if (string.IsNullOrWhiteSpace(licenseKey))
        {
            WriteError("缺少 Syncfusion license 配置。", "license_missing");
            return 0;
        }

        try
        {
            SyncfusionLicenseProvider.RegisterLicense(licenseKey);
        }
        catch (Exception ex)
        {
            WriteError($"Syncfusion license 注册失败：{ex.Message}", "license_missing");
            return 0;
        }

        try
        {
            using var stream = File.OpenRead(inputPath);
            var document = Syncfusion.EJ2.DocumentEditor.WordDocument.Load(
                stream,
                Syncfusion.EJ2.DocumentEditor.FormatType.Docx
            );
            try
            {
                var sfdt = Newtonsoft.Json.JsonConvert.SerializeObject(document);
                if (string.IsNullOrWhiteSpace(sfdt))
                {
                    WriteError("DOCX 转换结果为空。", "convert_failed");
                    return 0;
                }

                WriteSuccess(new ConvertResult
                {
                    Sfdt = sfdt,
                });
                return 0;
            }
            finally
            {
                // 中文注释：Syncfusion WordDocument 提供 Dispose()，但不满足 using 语法约束，这里显式释放。
                document.Dispose();
            }
        }
        catch (Exception ex)
        {
            WriteError($"DOCX 转换失败：{ex.Message}", "convert_failed");
            return 0;
        }
    }

    /// <summary>Handle unsupported helper action.</summary>
    private static int HandleUnsupportedAction(string action)
    {
        WriteError($"不支持的 action：{action}", "unsupported_action");
        return 1;
    }

    /// <summary>Resolve Syncfusion license key from environment.</summary>
    private static string? ResolveLicenseKey()
    {
        return Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY")
            ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY");
    }

    /// <summary>Deserialize helper payload.</summary>
    private static T? ReadPayload<T>(string payloadJson)
    {
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<T>(payloadJson, SerializerOptions);
        }
        catch
        {
            return default;
        }
    }

    /// <summary>Write a successful helper response.</summary>
    private static void WriteSuccess(object data)
    {
        var response = new HelperSuccessResponse<object>
        {
            Ok = true,
            Data = data,
        };
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(response, SerializerOptions));
    }

    /// <summary>Write a failed helper response.</summary>
    private static void WriteError(string reason, string code)
    {
        var response = new HelperErrorResponse
        {
            Ok = false,
            Reason = reason,
            Code = code,
        };
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(response, SerializerOptions));
    }

    /// <summary>Payload for DOCX conversion requests.</summary>
    private sealed class ConvertPayload
    {
        /// <summary>Absolute input DOCX file path.</summary>
        public string? InputPath { get; init; }
    }

    /// <summary>Conversion result payload.</summary>
    private sealed class ConvertResult
    {
        /// <summary>Serialized SFDT document string.</summary>
        public string Sfdt { get; init; } = string.Empty;
    }

    /// <summary>Successful helper response envelope.</summary>
    private sealed class HelperSuccessResponse<T>
    {
        /// <summary>Whether the helper action succeeded.</summary>
        public bool Ok { get; init; }

        /// <summary>Successful payload data.</summary>
        public T? Data { get; init; }
    }

    /// <summary>Failed helper response envelope.</summary>
    private sealed class HelperErrorResponse
    {
        /// <summary>Whether the helper action succeeded.</summary>
        public bool Ok { get; init; }

        /// <summary>Human-readable failure reason.</summary>
        public string Reason { get; init; } = string.Empty;

        /// <summary>Stable machine-readable failure code.</summary>
        public string Code { get; init; } = string.Empty;
    }
}
