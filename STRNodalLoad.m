classdef STRNodalLoad < handle

    properties
        Id;
        Fx;
        Fy;
        Fz;
        Mx;
        My;
        Mz;
        AppliedTo;
    end

    methods
        function obj = STRNodalLoad(id, fx, fy, fz, mx ,my , mz)
                obj.Id = id;
                obj.Fx = fx;
                obj.Fy = fy;
                obj.Fz = fz;
                obj.Mx = mx;
                obj.My = my;
                obj.Mz = mz;
        end

        function ToString(obj)
            fprintf("Nodal Force #%i\n", obj.Id);
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