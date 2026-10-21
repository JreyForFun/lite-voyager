param([Parameter(Mandatory = $true)][int]$OwnerProcessId)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading.Tasks;

public static class LiteVoyagerVerificationAwake {
    [DllImport("kernel32.dll")]
    private static extern uint SetThreadExecutionState(uint flags);

    public static void Hold(int ownerProcessId) {
        using (Process owner = Process.GetProcessById(ownerProcessId)) {
        // Pin the original owner process handle, even if its PID is later reused.
        IntPtr ownerHandle = owner.Handle;
        // One synchronous native thread owns the request through release/owner exit.
        // System only: do not force the display on, use away mode, or change a power plan.
        if (SetThreadExecutionState(0x80000001) == 0) {
            throw new InvalidOperationException("Could not acquire verification system-awake request.");
        }
        try {
            Console.Out.WriteLine("lite-voyager-awake-ready");
            Console.Out.Flush();
            Task input = Task.Run(() => Console.In.ReadToEnd());
            while (!input.IsCompleted && !owner.WaitForExit(250)) { }
            if (input.IsCompleted) { input.GetAwaiter().GetResult(); }
        } finally {
            uint previous = SetThreadExecutionState(0x80000000);
            if ((previous & 1) == 0) {
                throw new InvalidOperationException("Verification system-awake request was not held at release.");
            }
        }
        Console.Out.WriteLine("lite-voyager-awake-released");
        Console.Out.Flush();
        }
    }
}
'@
    [LiteVoyagerVerificationAwake]::Hold($OwnerProcessId)
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
