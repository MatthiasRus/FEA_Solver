classdef STRLineLoadDistributed < handle

    properties
        Id;
        LoadCaseId;
        FxStart;
        FyStart;
        FzStart;
        MxStart;
        MyStart;
        MzStart;
        RelativeLocationStart;
        
        FxEnd;
        FyEnd;
        FzEnd;
        MxEnd;
        MyEnd;
        MzEnd;
        RelativeLocationEnd;
        AppliedTo;
    end

    methods
        function obj = STRLineLoadDistributed(id,LoadCaseId, fx1, fy1, fz1, mx1 ,my1 , mz1, relativeLocation1, ...
                fx2, fy2, fz2, mx2 ,my2 , mz2,relativeLocation2)
                obj.Id = id;
                obj.LoadCaseId = LoadCaseId;
                obj.FxStart = fx1;
                obj.FyStart = fy1;
                obj.FzStart = fz1;
                obj.MxStart = mx1;
                obj.MyStart = my1;
                obj.MzStart = mz1;
                obj.RelativeLocationStart = relativeLocation1;
                
                obj.FxEnd = fx2;
                obj.FyEnd = fy2;
                obj.FzEnd = fz2;
                obj.MxEnd = mx2;
                obj.MyEnd = my2;
                obj.MzEnd = mz2;
                obj.RelativeLocationEnd = relativeLocation2;

        end

        function ToString(obj)
            fprintf("Line Load Distributed #%i LC%i @S(%5.2f) --> E(%5.2f)\n", obj.Id,obj.LoadCaseId, ...
                obj.RelativeLocationStart,obj.RelativeLocationEnd);
            fprintf("Fx = %5.2f  -->  %5.2f\n", obj.FxStart,obj.FxEnd);
            fprintf("Fy = %5.2f  -->  %5.2f\n", obj.FyStart,obj.FyEnd);
            fprintf("Fz = %5.2f  -->  %5.2f\n", obj.FzStart,obj.FzEnd);
            fprintf("Mx = %5.2f  -->  %5.2f\n", obj.MxStart,obj.MxEnd);
            fprintf("My = %5.2f  -->  %5.2f\n", obj.MyStart,obj.MyEnd);
            fprintf("Mz = %5.2f  -->  %5.2f\n", obj.MzStart,obj.MzEnd);
            fprintf("Applied To ==> %i\n", obj.AppliedTo);
        end
    end
end