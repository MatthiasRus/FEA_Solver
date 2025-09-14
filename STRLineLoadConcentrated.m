classdef STRLineLoadConcentrated < handle

    properties
        Id;
        LoadCaseId;
        Fx;
        Fy;
        Fz;
        Mx;
        My;
        Mz;
        AppliedTo;
        RelativeLocation;
    end

    methods
        function obj = STRLineLoadConcentrated(id,LoadCaseId, fx, fy, fz, mx ,my , mz, relativeLocation)
                obj.Id = id;
                obj.LoadCaseId = LoadCaseId;
                obj.Fx = fx;
                obj.Fy = fy;
                obj.Fz = fz;
                obj.Mx = mx;
                obj.My = my;
                obj.Mz = mz;
                obj.RelativeLocation = relativeLocation;
        end

        function ToString(obj)
            fprintf("Line Load Concentrated #%i LC%i @(%5.2f)\n", obj.Id,obj.LoadCaseId, obj.RelativeLocation);
            fprintf("Fx = %5.2f\t", obj.Fx);
            fprintf("Fy = %5.2f\t", obj.Fy);
            fprintf("Fz = %5.2f\n", obj.Fz);
            fprintf("Mx = %5.2f\t", obj.Mx);
            fprintf("My = %5.2f\t", obj.My);
            fprintf("Mz = %5.2f\n", obj.Mz);
            fprintf("Applied To ==> %i\n", obj.AppliedTo);
        end
    end
end